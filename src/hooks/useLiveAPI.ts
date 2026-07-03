import { useState, useRef, useEffect, useCallback } from 'react';

function pcmToBase64(pcmData: Float32Array): string {
  const buffer = new ArrayBuffer(pcmData.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < pcmData.length; i++) {
    let s = Math.max(-1, Math.min(1, pcmData[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(i * 2, s, true); // little endian
  }
  
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768;
  }
  return float32Array;
}

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export function useLiveAPI() {
  const [state, setState] = useState<ConnectionState>('idle');
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const cleanupAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(console.error);
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(console.error);
      outputCtxRef.current = null;
    }
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanupAudio();
    setState('idle');
  }, [cleanupAudio]);

  const connect = useCallback(async () => {
    setState('connecting');
    try {
      // 1. Get mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        } 
      });
      streamRef.current = stream;

      // 2. Setup audio contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputCtxRef.current = inputCtx;

      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      outputCtxRef.current = outputCtx;

      // 3. Setup mic processing
      const source = inputCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      source.connect(processor);
      processor.connect(inputCtx.destination);

      // 4. Connect WebSocket
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setState('connected');
        
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN && !isMutedRef.current) {
            const pcm = e.inputBuffer.getChannelData(0);
            const base64 = pcmToBase64(pcm);
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.audio && outputCtxRef.current) {
          const float32Array = base64ToFloat32(msg.audio);
          const audioBuffer = outputCtx.createBuffer(1, float32Array.length, 24000);
          audioBuffer.getChannelData(0).set(float32Array);
          
          const audioSource = outputCtx.createBufferSource();
          audioSource.buffer = audioBuffer;
          audioSource.connect(outputCtx.destination);
          
          const currentTime = outputCtx.currentTime;
          if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime + 0.05; 
          }
          
          audioSource.start(nextStartTimeRef.current);
          nextStartTimeRef.current += audioBuffer.duration;
          
          activeSourcesRef.current.push(audioSource);
          
          audioSource.onended = () => {
            activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== audioSource);
          };
        }
        
        if (msg.interrupted && outputCtxRef.current) {
          activeSourcesRef.current.forEach(s => {
            try { s.stop(); } catch (e) {}
          });
          activeSourcesRef.current = [];
          nextStartTimeRef.current = outputCtxRef.current.currentTime;
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error", e);
        setState('error');
        disconnect();
      };

      ws.onclose = () => {
        disconnect();
      };

    } catch (err) {
      console.error("Connection failed", err);
      setState('error');
      cleanupAudio();
    }
  }, [disconnect, cleanupAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  return {
    state,
    isMuted,
    connect,
    disconnect,
    toggleMute
  };
}
