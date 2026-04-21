"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Camera, CheckCircle2, Bell, MessageCircle, X } from "lucide-react";

type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type MessageItem = {
  id: string;
  threadId: string;
  content: string;
  sender: 'patient' | 'dentist';
  createdAt: string;
};

export default function ScanningFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camReady, setCamReady] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stabilityColor, setStabilityColor] = useState<'red' | 'amber' | 'green'>('red');
  const [faceInFrame, setFaceInFrame] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);
  const prevGamma = useRef<number | null>(null);
  const prevBeta = useRef<number | null>(null);
  const lastUpdate = useRef(0);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scanIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const VIEWS = [
    { label: "Front View",    instruction: "Look straight at the camera and smile gently." },
    { label: "Left Side",     instruction: "Turn your head slowly to the left." },
    { label: "Right Side",    instruction: "Turn your head slowly to the right." },
    { label: "Upper Teeth",   instruction: "Tilt your head back slightly and open wide." },
    { label: "Lower Teeth",   instruction: "Tilt your chin down and open wide." },
  ];

  // ── Notification helpers ─────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notify?userId=clinic-user');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch('/api/notify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'clinic-user' }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  }, []);

  // Fetch on mount + poll every 10 s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Camera init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCamReady(true);
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    startCamera();
  }, []);

  // ── Scan complete: prepare IDs, wait for user to hit Submit ─────────────────
  useEffect(() => {
    if (currentStep === 5) {
      const scanId = `scan-${Date.now()}`;
      scanIdRef.current = scanId;
      setThreadId(`thread-${scanId}`);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    if (!scanIdRef.current || isSubmitting || submitted) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanId: scanIdRef.current, status: 'completed' }),
      });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      setSubmitted(true);
      fetchNotifications();
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, submitted, fetchNotifications]);

  // ── Load thread messages ─────────────────────────────────────────────────────
  useEffect(() => {
    if (threadId) {
      fetch(`/api/messaging?threadId=${threadId}`)
        .then(res => res.json())
        .then(data => setMessages(data.messages || []))
        .catch(err => console.error('Failed to load messages:', err));
    }
  }, [threadId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !threadId || isSending) return;
    const messageContent = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    const tempMessage: MessageItem = {
      id: `temp-${Date.now()}`,
      threadId,
      content: messageContent,
      sender: 'patient',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);
    try {
      const res = await fetch('/api/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, content: messageContent, sender: 'patient' }),
      });
      if (!res.ok) throw new Error(`Send failed: ${res.status}`);
      const data = await fetch(`/api/messaging?threadId=${threadId}`).then(r => r.json());
      setMessages(data.messages ?? []);
    } catch (err) {
      console.error('Send message failed:', err);
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(messageContent);
    } finally {
      setIsSending(false);
    }
  }, [newMessage, threadId, isSending]);

  // ── Stability: device orientation (mobile) ───────────────────────────────────
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const now = Date.now();
      if (now - lastUpdate.current < 100) return;
      const beta = event.beta || 0;
      const gamma = event.gamma || 0;
      if (prevBeta.current !== null && prevGamma.current !== null) {
        const delta = Math.sqrt((beta - prevBeta.current) ** 2 + (gamma - prevGamma.current) ** 2);
        if (delta <= 5) setStabilityColor('green');
        else if (delta <= 10) setStabilityColor('amber');
        else setStabilityColor('red');
      }
      prevBeta.current = beta;
      prevGamma.current = gamma;
      lastUpdate.current = now;
    };
    if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // ── Stability: canvas frame-differencing (desktop fallback) ─────────────────
  useEffect(() => {
    if (!camReady || currentStep >= 5) return;
    let hasOrientation = false;
    const probe = () => { hasOrientation = true; };
    window.addEventListener('deviceorientation', probe, { once: true });

    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    let prevData: Uint8ClampedArray | null = null;
    let running = true;
    let tid: ReturnType<typeof setTimeout>;

    const check = () => {
      if (!running || hasOrientation) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) { tid = setTimeout(check, 150); return; }
      ctx.drawImage(video, 0, 0, 64, 64);
      const curr = ctx.getImageData(0, 0, 64, 64).data;
      if (prevData) {
        let diff = 0;
        for (let i = 0; i < curr.length; i += 4) diff += Math.abs(curr[i] - prevData[i]);
        const avg = diff / (64 * 64);
        if (avg < 4) setStabilityColor('green');
        else if (avg < 12) setStabilityColor('amber');
        else setStabilityColor('red');
      }
      prevData = new Uint8ClampedArray(curr);
      if (running) tid = setTimeout(check, 120);
    };

    tid = setTimeout(check, 300);
    return () => { running = false; clearTimeout(tid); window.removeEventListener('deviceorientation', probe); };
  }, [camReady, currentStep]);

  // ── Face-in-guide detection (FaceDetector API) ───────────────────────────────
  useEffect(() => {
    if (!camReady || currentStep >= 5) return;
    if (!('FaceDetector' in window)) { setFaceInFrame(true); return; }

    const detector = new (window as any).FaceDetector({ fastMode: true });
    let running = true;
    let tid: ReturnType<typeof setTimeout>;

    const detect = async () => {
      if (!running) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) { tid = setTimeout(detect, 400); return; }
      try {
        const faces = await detector.detect(video);
        if (faces.length === 0) {
          setFaceInFrame(false);
        } else {
          const vw = video.videoWidth || 1;
          const vh = video.videoHeight || 1;
          const inside = faces.some((face: any) => {
            const { x, y, width, height } = face.boundingBox;
            const cx = (x + width / 2) / vw;
            const cy = (y + height / 2) / vh;
            return Math.abs(cx - 0.5) < 0.3 && Math.abs(cy - 0.5) < 0.35;
          });
          setFaceInFrame(inside);
        }
      } catch { setFaceInFrame(true); }
      if (running) tid = setTimeout(detect, 400);
    };

    detect();
    return () => { running = false; clearTimeout(tid); };
  }, [camReady, currentStep]);

  // ── Derived state ────────────────────────────────────────────────────────────
  const effectiveColor = faceInFrame ? stabilityColor : 'red';
  const isReady = effectiveColor === 'green';

  const statusHint = !faceInFrame
    ? 'Position your face in the guide'
    : effectiveColor === 'green' ? 'Perfect — tap to capture'
    : effectiveColor === 'amber' ? 'Almost there, hold steady'
    : 'Hold still and face the camera';

  // ── Capture ──────────────────────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 180);

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImages(prev => [...prev, dataUrl]);
      setCurrentStep(prev => prev + 1);
    }
  }, []);

  // ── Color helpers ────────────────────────────────────────────────────────────
  const ringColor = {
    green: 'border-green-400',
    amber: 'border-amber-400',
    red:   'border-red-500',
  }[effectiveColor];

  const glowColor = {
    green: '0 0 24px rgba(74,222,128,0.35)',
    amber: '0 0 20px rgba(251,191,36,0.3)',
    red:   '0 0 20px rgba(239,68,68,0.25)',
  }[effectiveColor];

  const pillBg = {
    green: 'bg-green-950/80 border-green-700/40 text-green-300',
    amber: 'bg-amber-950/80 border-amber-700/40 text-amber-300',
    red:   'bg-red-950/80 border-red-800/40 text-red-300',
  }[effectiveColor];

  const dotColor = {
    green: 'bg-green-400',
    amber: 'bg-amber-400',
    red:   'bg-red-400',
  }[effectiveColor];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center bg-black min-h-screen text-white select-none">

      {/* ── Header ── */}
      <div ref={notifPanelRef} className="relative w-full max-w-md">
        <div className="px-5 py-3 bg-zinc-950 border-b border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-[0.15em] uppercase text-white">DentalScan AI</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Step progress bar */}
            <div className="flex items-center gap-1">
              {VIEWS.map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-500 ${
                  i < currentStep  ? 'bg-blue-400 w-5' :
                  i === currentStep && currentStep < 5 ? 'bg-white w-6' :
                  'bg-zinc-700 w-5'
                }`} />
              ))}
            </div>
            {/* Bell */}
            <button
              onClick={() => {
                const opening = !showNotifications;
                setShowNotifications(opening);
                if (opening && unreadCount > 0) markAllRead();
              }}
              className="relative p-1 text-zinc-400 hover:text-white transition-colors"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-[9px] font-bold flex items-center justify-center text-white leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Notification panel */}
        {showNotifications && (
          <div className="absolute top-full right-0 w-72 bg-zinc-900 border border-zinc-800 rounded-b-xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Notifications</span>
              {notifications.some(n => !n.read) && (
                <button onClick={markAllRead} className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors">
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-64">
              {notifications.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-8">No notifications yet</p>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 border-b border-zinc-800/50 flex gap-2.5 ${!n.read ? 'bg-zinc-800/50' : ''}`}>
                    {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                    <div className={!n.read ? '' : 'ml-4'}>
                      <p className="text-xs font-medium text-zinc-200">{n.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[10px] text-zinc-700 mt-1">
                        {new Date(n.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Viewport ── */}
      <div className={`relative w-full max-w-md bg-black overflow-hidden ${submitted ? 'flex-1' : 'aspect-[3/4]'}`}>

        {currentStep < 5 ? (
          /* ── Camera view ── */
          <>
            {/* Video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)', opacity: camReady ? 0.92 : 0, transition: 'opacity 0.7s ease' }}
            />

            {/* Camera initializing */}
            {!camReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
                <div className="w-9 h-9 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin" />
                <p className="text-xs tracking-widest uppercase">Initializing camera…</p>
              </div>
            )}

            {/* Capture flash */}
            {isFlashing && (
              <div className="absolute inset-0 bg-white pointer-events-none z-50" style={{ opacity: 0.85 }} />
            )}

            {/* Radial vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 38%, rgba(0,0,0,0.65) 100%)' }}
            />

            {/* ── Guide overlay ── */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {currentStep <= 2 ? (
                /* Face circle — front / side views */
                <div
                  className={`w-64 h-64 md:w-72 md:h-72 rounded-full border-2 border-dashed transition-all duration-500 ${ringColor}`}
                  style={{ boxShadow: glowColor }}
                />
              ) : (
                /* Teeth circle — upper / lower teeth */
                <div
                  className={`w-64 h-64 md:w-72 md:h-72 rounded-full border-2 border-dashed transition-all duration-500 ${ringColor}`}
                  style={{
                    marginTop: currentStep === 3 ? '-10%' : '10%',
                    boxShadow: glowColor,
                  }}
                />
              )}
            </div>

            {/* Viewfinder corner brackets */}
            <div className="absolute inset-5 pointer-events-none">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[1.5px] border-l-[1.5px] border-white/30 rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[1.5px] border-r-[1.5px] border-white/30 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[1.5px] border-l-[1.5px] border-white/30 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[1.5px] border-r-[1.5px] border-white/30 rounded-br" />
            </div>

            {/* Step label — top-left */}
            <div className="absolute top-4 left-4 pointer-events-none">
              <span className="text-[10px] text-white/35 uppercase tracking-[0.18em]">
                {VIEWS[currentStep].label}
              </span>
            </div>

            {/* Status pill — top-center */}
            <div className="absolute top-3.5 inset-x-0 flex justify-center pointer-events-none">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium backdrop-blur-md border transition-all duration-300 ${pillBg}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor} ${isReady ? 'animate-pulse' : ''}`} />
                {statusHint}
              </div>
            </div>

            {/* Bottom gradient + instruction */}
            <div
              className="absolute bottom-0 inset-x-0 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 55%, transparent 100%)' }}
            >
              <div className="px-8 pt-14 pb-5 text-center">
                <p className="text-sm text-zinc-100 leading-relaxed">{VIEWS[currentStep].instruction}</p>
              </div>
            </div>
          </>
        ) : !submitted ? (
          /* ── Review screen (all 5 taken, not yet submitted) ── */
          <div className="flex flex-col items-center justify-center h-full gap-5 bg-zinc-950 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-900/30 border border-blue-700/40 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">All 5 photos captured</h2>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Review your shots below, then tap Submit to send them to your clinic.
              </p>
            </div>
          </div>
        ) : (
          /* ── Results screen ── */
          <div className="relative flex flex-col h-full bg-zinc-950 overflow-hidden">

            {/* Summary — full width, always visible */}
            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-24 flex flex-col gap-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center">
                  <CheckCircle2 size={22} className="text-green-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Scan Complete</h2>
                  <p className="text-[11px] text-zinc-500 mt-0.5">5 photos submitted to your clinic</p>
                </div>
              </div>

              {/* Thumbnails */}
              <div className="grid grid-cols-3 gap-2">
                {capturedImages.map((img, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden border border-zinc-800">
                      <img src={img} className="w-full h-full object-cover" alt={VIEWS[i]?.label} />
                    </div>
                    <p className="text-[9px] text-zinc-600 text-center">{VIEWS[i]?.label}</p>
                  </div>
                ))}
              </div>

              {/* AI result */}
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">AI Analysis</p>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Possible early-stage cavity detected in lower-left region. Consult your dentist for a full examination.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-green-900/30 border border-green-800/40">
                <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                <span className="text-xs text-green-400 font-medium">Submitted to clinic</span>
              </div>
            </div>

            {/* Floating chat button */}
            {!showChat && (
              <button
                onClick={() => setShowChat(true)}
                className="absolute bottom-5 right-5 w-14 h-14 bg-blue-600 hover:bg-blue-500 active:scale-95 rounded-full shadow-2xl flex items-center justify-center transition-all"
              >
                <MessageCircle size={22} className="text-white" />
                {messages.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {messages.length}
                  </span>
                )}
              </button>
            )}

            {/* Chat bubble popup */}
            <div className={`absolute bottom-20 right-4 w-72 h-80 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-200 origin-bottom-right ${showChat ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
              <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <p className="text-sm font-semibold text-white">Clinic Chat</p>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
                {messages.length === 0 && (
                  <p className="text-xs text-zinc-600 text-center pt-8 leading-relaxed">
                    Send your dentist a message about your scan.
                  </p>
                )}
                {messages.map(msg => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender === 'patient' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'patient'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-zinc-700 mt-0.5 px-1">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-4 py-3 border-t border-zinc-800 flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    placeholder="Message your clinic…"
                    className="flex-1 px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-xs placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isSending}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-medium transition-colors"
                  >
                    {isSending ? '…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Controls: capture button OR submit button ── */}
      {!submitted && (
        <div className="py-7 w-full max-w-md flex justify-center bg-zinc-950">
          {currentStep < 5 ? (
            /* Capture button */
            <div className="relative flex items-center justify-center">
              {isReady && (
                <span className="absolute w-24 h-24 rounded-full border border-green-400/30 animate-ping" />
              )}
              <button
                onClick={handleCapture}
                className={`relative w-20 h-20 rounded-full border-[3px] flex items-center justify-center transition-all duration-300 active:scale-90 ${
                  isReady
                    ? 'border-green-400 shadow-[0_0_24px_rgba(74,222,128,0.4)]'
                    : effectiveColor === 'amber'
                      ? 'border-amber-400'
                      : 'border-white/25'
                }`}
              >
                <div className={`w-[62px] h-[62px] rounded-full flex items-center justify-center transition-all duration-300 ${
                  isReady ? 'bg-green-400' :
                  effectiveColor === 'amber' ? 'bg-white/90' :
                  'bg-white/60'
                }`}>
                  <Camera size={22} className="text-black" />
                </div>
              </button>
            </div>
          ) : (
            /* Submit button */
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-12 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all active:scale-95"
            >
              {isSubmitting ? 'Uploading…' : 'Submit Scan'}
            </button>
          )}
        </div>
      )}

      {/* ── Thumbnail strip ── */}
      {!submitted && (
        <div className="flex gap-2 px-4 pb-6 w-full max-w-md">
          {VIEWS.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full aspect-[3/4] rounded-lg border overflow-hidden transition-all duration-300 ${
                i < currentStep  ? 'border-blue-400/70' :
                i === currentStep ? 'border-white/70 ring-1 ring-white/20' :
                'border-zinc-800'
              }`}>
                {capturedImages[i] ? (
                  <img src={capturedImages[i]} className="w-full h-full object-cover" alt={v.label} />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                    {i === currentStep
                      ? <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
                      : <span className="text-[9px] text-zinc-700 font-medium">{i + 1}</span>
                    }
                  </div>
                )}
              </div>
              <span className={`text-[8px] text-center leading-tight transition-colors ${
                i === currentStep ? 'text-white/80' :
                i < currentStep  ? 'text-blue-400/70' :
                'text-zinc-700'
              }`}>{v.label.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
