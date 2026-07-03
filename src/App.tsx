import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, User, Grid, Plus, Video, Contact } from 'lucide-react';
import { useLiveAPI } from './hooks/useLiveAPI';

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const { state, isMuted, connect, disconnect, toggleMute } = useLiveAPI();
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const handleAccept = () => {
    connect();
  };

  const handleDecline = () => {
    if (state !== 'idle') {
      disconnect();
    }
  };

  return (
    <div className="min-h-screen bg-[#1c1c1e] text-white flex flex-col items-center justify-between py-12 px-6 font-sans relative overflow-hidden select-none">
      {/* Background blurred gradient for Apple feel */}
      <div className="absolute inset-0 z-0 opacity-60">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-slate-600/30 to-black/80 blur-3xl"></div>
      </div>

      <div className="z-10 flex flex-col items-center mt-12 w-full max-w-sm">
        {/* Avatar Placeholder */}
        <div className="w-28 h-28 rounded-full bg-slate-500/40 flex items-center justify-center mb-4 shadow-2xl backdrop-blur-md">
          <span className="text-4xl text-white font-medium">HD</span>
        </div>

        <h1 className="text-4xl font-normal tracking-tight mb-2">Hope Dental</h1>
        <p className="text-[17px] text-white/70 font-normal">
          {state === 'idle' && 'Incoming Call'}
          {state === 'connecting' && 'Connecting...'}
          {state === 'connected' && formatTime(callDuration)}
          {state === 'error' && 'Call Failed'}
        </p>
      </div>

      <div className="z-10 w-full max-w-sm mb-6">
        {state === 'idle' || state === 'error' ? (
          <div className="flex justify-between items-center px-10 mt-20">
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={handleDecline}
                className="w-[72px] h-[72px] rounded-full bg-[#eb4e3d] flex items-center justify-center transition-transform active:scale-95"
              >
                <PhoneOff className="w-8 h-8 fill-current text-white" />
              </button>
              <span className="text-[15px] font-normal text-white">Decline</span>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={handleAccept}
                className="w-[72px] h-[72px] rounded-full bg-[#34c759] flex items-center justify-center transition-transform active:scale-95"
              >
                <Phone className="w-8 h-8 fill-current text-white" />
              </button>
              <span className="text-[15px] font-normal text-white">Accept</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-16 items-center w-full">
            <div className="grid grid-cols-3 gap-x-6 gap-y-4 w-full px-6">
              <button 
                onClick={toggleMute}
                className={`flex flex-col items-center justify-center gap-2 ${isMuted ? 'text-black' : 'text-white'}`}
              >
                <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white' : 'bg-white/10 backdrop-blur-sm'}`}>
                  {isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </div>
                <span className="text-[13px] font-normal">mute</span>
              </button>
              
              <button className="flex flex-col items-center justify-center gap-2 text-white">
                <div className="w-[72px] h-[72px] rounded-full bg-white/10 flex items-center justify-center">
                  <Grid className="w-8 h-8" />
                </div>
                <span className="text-[13px] font-normal">keypad</span>
              </button>

              <button className="flex flex-col items-center justify-center gap-2 text-white">
                <div className="w-[72px] h-[72px] rounded-full bg-white/10 flex items-center justify-center">
                  <Volume2 className="w-8 h-8" />
                </div>
                <span className="text-[13px] font-normal">speaker</span>
              </button>

              <button className="flex flex-col items-center justify-center gap-2 text-white opacity-50">
                <div className="w-[72px] h-[72px] rounded-full bg-white/10 flex items-center justify-center">
                  <Plus className="w-8 h-8" />
                </div>
                <span className="text-[13px] font-normal">add call</span>
              </button>
              
              <button className="flex flex-col items-center justify-center gap-2 text-white opacity-50">
                <div className="w-[72px] h-[72px] rounded-full bg-white/10 flex items-center justify-center">
                  <Video className="w-8 h-8" />
                </div>
                <span className="text-[13px] font-normal">FaceTime</span>
              </button>

              <button className="flex flex-col items-center justify-center gap-2 text-white opacity-50">
                <div className="w-[72px] h-[72px] rounded-full bg-white/10 flex items-center justify-center">
                  <Contact className="w-8 h-8" />
                </div>
                <span className="text-[13px] font-normal">contacts</span>
              </button>
            </div>

            <button 
              onClick={handleDecline}
              className="w-[72px] h-[72px] rounded-full bg-[#eb4e3d] flex items-center justify-center transition-transform active:scale-95"
            >
              <PhoneOff className="w-9 h-9 fill-current text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
