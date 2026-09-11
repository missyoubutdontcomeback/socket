import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import SearchableSelect from './SearchableSelect';

interface VideoChatProps {
    userConfig: any;
    onStop: () => void;
}

interface Message {
    text: string;
    sender: 'me' | 'partner' | 'system';
    timestamp: number;
    country?: string;
}

export default function VideoChat({ userConfig, onStop }: VideoChatProps) {
    const [status, setStatus] = useState<string>('');
    const [partnerCountry, setPartnerCountry] = useState<string>('');
    const [partnerProvince, setPartnerProvince] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageInput, setMessageInput] = useState<string>('');
    const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
    const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
    const [partnerVideoEnabled, setPartnerVideoEnabled] = useState<boolean>(true);
    const [hasCamera, setHasCamera] = useState<boolean>(true);
    const [isStarted, setIsStarted] = useState<boolean>(false);
    const [onlineUsers, setOnlineUsers] = useState<number>(0);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
    const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
    const [tempSettings, setTempSettings] = useState<any>(null);
    const [partnerAudioEnabled, setPartnerAudioEnabled] = useState<boolean>(true);

    const socketRef = useRef<Socket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const isOfferSentRef = useRef<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        initializeSocket();
        initializeWelcomeMessage();
        return () => {
            cleanup();
        };
    }, []);

    const generateFingerprint = () => {
        // สร้าง fingerprint จาก browser properties
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('fingerprint', 2, 2);
        }

        const canvasData = canvas.toDataURL();
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width,
            screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            canvasData.slice(0, 50)
        ].join('|');

        // แปลงเป็น hash
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        return 'fp_' + Math.abs(hash).toString(36);
    };

    const initializeWelcomeMessage = () => {
        const welcomeMsg: Message = {
            text: 'ยินดีต้อนรับสู่ Pig Me! พบเพื่อนใหม่และสนุกกับการสนทนา โปรดปฏิบัติตามกฎของชุมชนและเคารพผู้อื่น',
            sender: 'system',
            timestamp: Date.now()
        };
        setMessages([welcomeMsg]);
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Ensure local video stream is connected when stream is available
    useEffect(() => {
        const connectVideo = () => {
            if (localVideoRef.current && localStreamRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
                localVideoRef.current.play().catch(err => console.log('Play error:', err));
                console.log('Local video stream connected');
            }
        };

        connectVideo();
    }, [isStarted]);

    const initializeSocket = () => {
        socketRef.current = io('https://socket-production-686f.up.railway.app');
        const socket = socketRef.current;

        // ส่ง fingerprint ทันทีหลังเชื่อมต่อ
        socket.on('connect', () => {
            const fingerprint = generateFingerprint();
            console.log('Sending fingerprint:', fingerprint);
            socket.emit('register-fingerprint', fingerprint);
        });

        // จัดการกรณีถูก disconnect เพราะ duplicate
        socket.on('duplicate-connection', () => {
            setShowDuplicateModal(true);
        });

        setupSocketEvents();
    };

    const initializeMedia = async () => {
        try {
            console.log('🎥 Requesting camera and microphone...');
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            console.log('✅ Got media stream:', stream);
            console.log('Video tracks:', stream.getVideoTracks());
            console.log('Audio tracks:', stream.getAudioTracks());

            localStreamRef.current = stream;
            setHasCamera(true);

            // Force update video element
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.muted = true;
                await localVideoRef.current.play().catch(err => {
                    console.log('Auto-play prevented:', err);
                });
                console.log('✅ Camera initialized successfully');
            }
        } catch (mediaError: any) {
            console.error('❌ Camera error:', mediaError);
            setHasCamera(false);
            setStatus('⚠️ ไม่พบกล้อง กรุณาอนุญาตการเข้าถึงกล้องและไมค์');
        }
    };

    const handleStart = async () => {
        await initializeMedia();
        setIsStarted(true);
        // รอให้กล้องเริ่มทำงานก่อนแสดงสถานะ
        setTimeout(() => {
            setStatus('กดปุ่ม "ถัดไป" เพื่อเริ่มค้นหาคู่สนทนา');
        }, 500);
    };

    const setupSocketEvents = () => {
        const socket = socketRef.current;
        if (!socket) return;

        socket.on('waiting', () => {
            setStatus('กำลังค้นหาคู่สนทนา...');
            setIsSearching(true);
        });

        socket.on('partner-found', async (data) => {
            console.log('✅ Partner found:', data);
            setStatus('พบคู่สนทนาแล้ว!');
            setPartnerCountry(data.partnerCountry);
            setPartnerProvince(data.partnerProvince || '');
            setIsSearching(false);
            setPartnerVideoEnabled(true); // รีเซ็ต
            setPartnerAudioEnabled(true); // รีเซ็ต
            const welcomeMsg: Message = {
                text: 'ยินดีต้อนรับสู่ Pig Me! พบเพื่อนใหม่และสนุกกับการสนทนา โปรดปฏิบัติตามกฎของชุมชนและเคารพผู้อื่น',
                sender: 'system',
                timestamp: Date.now()
            };
            setMessages([welcomeMsg]);

            // ส่งสถานะกล้องและไมค์ปัจจุบันไปให้คู่สนทนา
            setTimeout(() => {
                if (localStreamRef.current) {
                    const videoTrack = localStreamRef.current.getVideoTracks()[0];
                    const audioTrack = localStreamRef.current.getAudioTracks()[0];

                    if (videoTrack) {
                        socket.emit('video-toggle', { enabled: videoTrack.enabled });
                    }
                    if (audioTrack) {
                        socket.emit('audio-toggle', { enabled: audioTrack.enabled });
                    }
                }
            }, 500);
        });

        socket.on('online-count', (count: number) => {
            setOnlineUsers(count);
        });

        socket.on('video-toggle', (data) => {
            console.log('Partner video toggle:', data.enabled);
            setPartnerVideoEnabled(data.enabled);
        });

        socket.on('audio-toggle', (data) => {
            console.log('Partner audio toggle:', data.enabled);
            setPartnerAudioEnabled(data.enabled);
        });

        socket.on('make-offer', async () => {
            console.log('📞 Server asked to make offer');
            await createPeerConnectionAndOffer();
        });

        socket.on('offer', async (data) => {
            console.log('📨 Received offer');
            try {
                if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                    peerConnectionRef.current = null;
                }

                const pc = createPeerConnection();
                peerConnectionRef.current = pc;

                await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('answer', { answer });
                console.log('📤 Answer sent');
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        });

        socket.on('answer', async (data) => {
            console.log('📨 Received answer');
            try {
                const pc = peerConnectionRef.current;
                if (!pc) {
                    console.error('No peer connection');
                    return;
                }

                if (pc.signalingState === 'have-local-offer') {
                    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                    console.log('✅ Answer applied');
                } else {
                    console.log('❌ Wrong state:', pc.signalingState);
                }
            } catch (error) {
                console.error('Error handling answer:', error);
            }
        });

        socket.on('ice-candidate', async (data) => {
            try {
                if (data.candidate && peerConnectionRef.current) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log('🧊 ICE candidate added');
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });

        socket.on('chat-message', (data) => {
            setMessages(prev => [...prev, {
                text: data.message,
                sender: 'partner',
                timestamp: Date.now(),
                country: partnerCountry
            }]);
        });

        socket.on('partner-disconnected', () => {
            setStatus('คู่สนทนาออกจากระบบ กำลังค้นหาคู่ใหม่...');
            closePeerConnection();
            setIsSearching(true);
            // Auto find next partner
            setTimeout(() => {
                findPartner();
            }, 1000);
        });

        socket.on('finding-partner', () => {
            setStatus('กำลังค้นหาคู่สนทนาใหม่...');
            setPartnerCountry('');
            setPartnerProvince('');
            setMessages([]);
        });
    };

    const createPeerConnection = () => {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(configuration);

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        pc.ontrack = (event) => {
            console.log('🎥 Received remote track:', event.track.kind);
            console.log('Remote streams:', event.streams);
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                console.log('✅ Remote video connected');
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('ice-candidate', { candidate: event.candidate });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('🔌 Connection state:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                setStatus('เชื่อมต่อสำเร็จ!');
            } else if (pc.connectionState === 'failed') {
                setStatus('การเชื่อมต่อล้มเหลว');
            }
        };

        return pc;
    };

    const createPeerConnectionAndOffer = async () => {
        try {
            if (isOfferSentRef.current) {
                console.log('Offer already sent, skipping');
                return;
            }

            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }

            const pc = createPeerConnection();
            peerConnectionRef.current = pc;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('offer', { offer });
            isOfferSentRef.current = true;
            console.log('📤 Offer sent');
        } catch (error) {
            console.error('Error creating offer:', error);
            isOfferSentRef.current = false;
        }
    };

    const findPartner = () => {
        setStatus('กำลังค้นหาคู่สนทนา...');
        setPartnerCountry('');
        setPartnerProvince('');
        setIsSearching(true);
        const welcomeMsg: Message = {
            text: 'ยินดีต้อนรับสู่ Pig Me! พบเพื่อนใหม่และสนุกกับการสนทนา โปรดปฏิบัติตามกฎของชุมชนและเคารพผู้อื่น',
            sender: 'system',
            timestamp: Date.now()
        };
        setMessages([welcomeMsg]);
        closePeerConnection();
        isOfferSentRef.current = false;
        socketRef.current?.emit('find-partner', userConfig);
    };

    const toggleAudio = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioEnabled(audioTrack.enabled);
                // แจ้งคู่สนทนาว่าปิด/เปิดไมค์
                socketRef.current?.emit('audio-toggle', { enabled: audioTrack.enabled });
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
                // แจ้งคู่สนทนาว่าปิดกล้อง
                socketRef.current?.emit('video-toggle', { enabled: videoTrack.enabled });
            }
        }
    };

    const handleNext = () => {
        socketRef.current?.emit('next');
        findPartner();
    };

    const handleStopSearching = () => {
        setIsSearching(false);
        setStatus('การค้นหาถูกยกเลิก กดปุ่ม "ถัดไป" เพื่อค้นหาใหม่');
        socketRef.current?.emit('stop-searching');
        closePeerConnection();
    };

    const handleOpenSettings = () => {
        setTempSettings({ ...userConfig });
        setShowSettingsModal(true);
    };

    const handleSaveSettings = () => {
        if (tempSettings) {
            // อัปเดต userConfig ใน parent component
            Object.assign(userConfig, tempSettings);
            localStorage.setItem('chatSettings', JSON.stringify(tempSettings));
            setShowSettingsModal(false);

            // ถ้ากำลังค้นหาอยู่ ให้ค้นหาใหม่ด้วยการตั้งค่าใหม่
            if (isSearching) {
                handleStopSearching();
                setTimeout(() => {
                    findPartner();
                }, 500);
            }
        }
    };

    const handleCloseSettings = () => {
        setShowSettingsModal(false);
        setTempSettings(null);
    };

    const THAILAND_PROVINCES = [
        'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น',
        'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร',
        'เชียงราย', 'เชียงใหม่', 'ตรัง', 'ตราด', 'ตาก', 'นครนายก',
        'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นนทบุรี',
        'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์',
        'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง',
        'พิจิตร', 'พิษณุโลก', 'เพชรบุรี', 'เพชรบูรณ์', 'แพร่', 'ภูเก็ต',
        'มหาสารคาม', 'มุกดาหาร', 'แม่ฮ่องสอน', 'ยโสธร', 'ยะลา', 'ร้อยเอ็ด',
        'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน',
        'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ',
        'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย',
        'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง',
        'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี'
    ];

    const provinceOptions = THAILAND_PROVINCES.map(province => ({
        value: province,
        label: province
    }));

    const preferProvinceOptions = [
        { value: 'any', label: 'ทั้งหมด' },
        ...provinceOptions
    ];

    const handleSendMessage = () => {
        if (messageInput.trim() && socketRef.current) {
            const newMessage: Message = {
                text: messageInput,
                sender: 'me',
                timestamp: Date.now(),
                country: userConfig.country
            };
            setMessages(prev => [...prev, newMessage]);
            socketRef.current.emit('chat-message', { message: messageInput });
            setMessageInput('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const closePeerConnection = () => {
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        isOfferSentRef.current = false;
    };

    const cleanup = () => {
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        closePeerConnection();
        socketRef.current?.disconnect();
    };

    const getCountryCode = (countryName: string): string => {
        const countryMap: { [key: string]: string } = {
            'Thailand': 'TH',
            'United States': 'US',
            'United Kingdom': 'GB',
            'Japan': 'JP',
            'Korea, Republic of': 'KR',
            'China': 'CN',
            'India': 'IN',
            'Indonesia': 'ID',
            'Philippines': 'PH',
            'Vietnam': 'VN',
            'Malaysia': 'MY',
            'Singapore': 'SG',
            'Australia': 'AU',
            'France': 'FR',
            'Germany': 'DE',
            'Italy': 'IT',
            'Spain': 'ES',
            'Brazil': 'BR',
            'Canada': 'CA',
            'Mexico': 'MX'
        };
        return countryMap[countryName] || 'UN';
    };

    const handleCloseDuplicateModal = () => {
        setShowDuplicateModal(false);
        window.close();
        // ถ้า window.close() ไม่ทำงาน (บาง browser ไม่อนุญาต) ให้ redirect
        setTimeout(() => {
            window.location.href = 'about:blank';
        }, 100);
    };

    return (
        <div className="container">
            {/* Duplicate Connection Modal */}
            {showDuplicateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-icon">
                            <img src="/pigme.png" alt="Warning" className="modal-logo" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }} />
                        </div>
                        <h2 className="modal-title">คุณเปิดหน้านี้อยู่แล้ว!</h2>
                        <p className="modal-message">กรุณาใช้เพียงแท็บเดียวเท่านั้น<br />ระบบจะปิดหน้านี้โดยอัตโนมัติ</p>
                        <button className="modal-button" onClick={handleCloseDuplicateModal}>
                            ตกลง
                        </button>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && tempSettings && (
                <div className="modal-overlay">
                    <div className="settings-modal-content">
                        <div className="settings-modal-header">
                            <img src="/pigme.png" alt="Settings" className="settings-icon" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }} />
                            <h2>ตั้งค่าการค้นหา</h2>
                        </div>

                        <div className="settings-form">
                            <div className="form-group">
                                <label>เพศของคุณ</label>
                                <select
                                    value={tempSettings.gender}
                                    onChange={(e) => {
                                        const newGender = e.target.value;
                                        setTempSettings({
                                            ...tempSettings,
                                            gender: newGender,
                                            preferGender: newGender === 'male' ? 'female' : newGender === 'female' ? 'male' : 'any'
                                        });
                                    }}
                                    className="settings-select"
                                >
                                    <option value="male">ชาย</option>
                                    <option value="female">หญิง</option>
                                    <option value="other">อื่นๆ</option>
                                </select>
                            </div>

                            {userConfig.country === 'Thailand' && (
                                <div className="form-group">
                                    <label>จังหวัดของคุณ</label>
                                    <SearchableSelect
                                        value={tempSettings.myProvince || ''}
                                        onChange={(value) => setTempSettings({ ...tempSettings, myProvince: value })}
                                        options={provinceOptions}
                                        placeholder="พิมพ์เพื่อค้นหาหรือเลือกจังหวัด..."
                                        className="settings-searchable"
                                    />
                                </div>
                            )}

                            <div className="form-group">
                                <label>ต้องการพบเพศ</label>
                                <select
                                    value={tempSettings.preferGender}
                                    onChange={(e) => setTempSettings({ ...tempSettings, preferGender: e.target.value })}
                                    className="settings-select"
                                >
                                    <option value="male">ชาย</option>
                                    <option value="female">หญิง</option>
                                    <option value="any">ทั้งหมด</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>ต้องการพบประเทศ</label>
                                <select
                                    value={tempSettings.preferCountry}
                                    onChange={(e) => setTempSettings({ ...tempSettings, preferCountry: e.target.value })}
                                    className="settings-select"
                                >
                                    <option value="any">ทั้งหมด</option>
                                    <option value="Thailand">ไทย</option>
                                </select>
                            </div>

                            {userConfig.country === 'Thailand' && tempSettings.preferCountry === 'Thailand' && (
                                <div className="form-group">
                                    <label>ต้องการพบจังหวัด</label>
                                    <SearchableSelect
                                        value={tempSettings.preferProvince || 'any'}
                                        onChange={(value) => setTempSettings({ ...tempSettings, preferProvince: value })}
                                        options={preferProvinceOptions}
                                        placeholder="เลือกจังหวัด"
                                        className="settings-searchable"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="settings-modal-buttons">
                            <button className="settings-btn settings-btn-cancel" onClick={handleCloseSettings}>
                                ยกเลิก
                            </button>
                            <button className="settings-btn settings-btn-save" onClick={handleSaveSettings}>
                                บันทึก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="header">
                <div className="logo-header">
                    <img src="/pigme.png" alt="Pig Me" className="logo-header-img" onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }} />
                    <h1>Pig Me</h1>
                </div>
                <div className="header-right">
                    <button className="settings-button" onClick={handleOpenSettings} title="ตั้งค่า">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
                        </svg>
                    </button>
                    <div className="online-counter">
                        <span className="online-dot"></span>
                        {onlineUsers.toLocaleString()} คนออนไลน์
                    </div>
                </div>
            </div>

            {!isStarted ? (
                <div className="start-screen">
                    <div className="start-card">
                        <img src="/pigme.png" alt="Pig Me" className="start-logo" onError={(e) => {
                            e.currentTarget.style.display = 'none';
                        }} />
                        <h2>พร้อมที่จะพบเพื่อนใหม่แล้วหรือยัง?</h2>
                        <div className="safety-notice">
                            <img src="/pigme.png" alt="Pig Me" className="notice-icon" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }} />
                            <p>เมื่อกดปุ่ม "เริ่มต้น" คุณยอมรับกฎของชุมชน ผู้ที่ละเมิดกฎจะถูกแบน โปรดให้ใบหน้าของคุณปรากฏในกรอบกล้องอยู่เสมอ</p>
                        </div>
                        <button className="btn-start" onClick={handleStart}>
                            เริ่มต้น
                        </button>
                        <div className="download-section">
                            <p className="download-title">ดาวน์โหลดแอป</p>
                            <div className="download-buttons">
                                <a href="#" className="download-btn android">
                                    <svg className="platform-icon" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.523 15.341l-.835-1.448a.5.5 0 01.137-.684l.007-.005c.228-.159.513-.189.77-.076l1.448.835a.5.5 0 01.184.684l-.006.008a.59.59 0 01-.769.197l-1.448-.835a.5.5 0 01-.184-.684l.006-.008zM6.477 15.341l.835-1.448a.5.5 0 00-.137-.684l-.007-.005a.589.589 0 00-.77-.076l-1.448.835a.5.5 0 00-.184.684l.006.008c.144.248.464.334.769.197l1.448-.835a.5.5 0 00.184-.684l-.006-.008zM7.5 1.5c-.828 0-1.5.672-1.5 1.5v9.5h12V3c0-.828-.672-1.5-1.5-1.5h-9zm4.5 13c-.828 0-1.5.672-1.5 1.5s.672 1.5 1.5 1.5 1.5-.672 1.5-1.5-.672-1.5-1.5-1.5zm-7 1c-.552 0-1 .448-1 1v4.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5V16.5c0-.552-.448-1-1-1zm14 0c-.552 0-1 .448-1 1v4.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5V16.5c0-.552-.448-1-1-1z" />
                                    </svg>
                                    <div>
                                        <div className="download-text">GET IT ON</div>
                                        <div className="download-store">Google Play</div>
                                    </div>
                                </a>
                                <a href="#" className="download-btn ios" onClick={(e) => {
                                    e.preventDefault();
                                    alert('สำหรับ iOS: กด ไอคอน "แชร์" ในเบราว์เซอร์ แล้วเลือก "เพิ่มที่หน้าจอโฮม"');
                                }}>
                                    <svg className="platform-icon" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                                    </svg>
                                    <div>
                                        <div className="download-text">Download on the</div>
                                        <div className="download-store">App Store</div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="video-chat-layout">
                        <div className="video-section">
                            <div className="video-wrapper main-video">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    playsInline
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                                {!partnerCountry && !isSearching && (
                                    <div className="video-placeholder">
                                        <div className="placeholder-content">
                                            <img src="/pigme.png" alt="Pig Me" className="placeholder-logo" onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }} />
                                            <p className="placeholder-text">กดปุ่ม "ถัดไป" เพื่อเริ่มค้นหาคู่สนทนา</p>
                                            <div className="placeholder-download">
                                                <p className="download-title-small">ดาวน์โหลดแอป</p>
                                                <div className="download-buttons-small">
                                                    <a href="#" className="download-btn-small android">
                                                        <svg className="platform-icon-small" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M17.523 15.341l-.835-1.448a.5.5 0 01.137-.684l.007-.005c.228-.159.513-.189.77-.076l1.448.835a.5.5 0 01.184.684l-.006.008a.59.59 0 01-.769.197l-1.448-.835a.5.5 0 01-.184-.684l.006-.008zM6.477 15.341l.835-1.448a.5.5 0 00-.137-.684l-.007-.005a.589.589 0 00-.77-.076l-1.448.835a.5.5 0 00-.184.684l.006.008c.144.248.464.334.769.197l1.448-.835a.5.5 0 00.184-.684l-.006-.008zM7.5 1.5c-.828 0-1.5.672-1.5 1.5v9.5h12V3c0-.828-.672-1.5-1.5-1.5h-9zm4.5 13c-.828 0-1.5.672-1.5 1.5s.672 1.5 1.5 1.5 1.5-.672 1.5-1.5-.672-1.5-1.5-1.5zm-7 1c-.552 0-1 .448-1 1v4.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5V16.5c0-.552-.448-1-1-1zm14 0c-.552 0-1 .448-1 1v4.5c0 .828.672 1.5 1.5 1.5s1.5-.672 1.5-1.5V16.5c0-.552-.448-1-1-1z" />
                                                        </svg>
                                                        <span>Android</span>
                                                    </a>
                                                    <a href="#" className="download-btn-small ios" onClick={(e) => {
                                                        e.preventDefault();
                                                        alert('สำหรับ iOS: กด ไอคอน "แชร์" ในเบราว์เซอร์ แล้วเลือก "เพิ่มที่หน้าจอโฮม"');
                                                    }}>
                                                        <svg className="platform-icon-small" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                                                        </svg>
                                                        <span>iOS</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {isSearching && (
                                    <div className="searching-overlay">
                                        <div className="static-overlay"></div>
                                        <div className="searching-content">
                                            <img src="/pigme.png" alt="Pig Me" className="searching-logo" onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }} />
                                            <p>กำลังค้นหาคู่สนทนา...</p>
                                            <div className="searching-dots">
                                                <span></span>
                                                <span></span>
                                                <span></span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {!partnerVideoEnabled && !isSearching && partnerCountry && (
                                    <div className="video-disabled-overlay">
                                        <div className="static-overlay"></div>
                                        <div className="video-disabled-content">
                                            <img src="/pigme.png" alt="Pig Me" className="disabled-logo" onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }} />
                                            <p>ไม่พบกล้องคู่สนทนา</p>
                                        </div>
                                    </div>
                                )}
                                <div className="video-label">คู่สนทนา</div>
                                {partnerCountry && !isSearching && (
                                    <div className="country-flag">
                                        {partnerCountry}
                                        {partnerProvince && ` - ${partnerProvince}`}
                                    </div>
                                )}
                                {!partnerAudioEnabled && partnerCountry && !isSearching && (
                                    <div className="audio-status">
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                                        </svg>
                                        ปิดไมค์
                                    </div>
                                )}
                            </div>

                            <div className={`video-wrapper self-video ${!isVideoEnabled ? 'video-disabled' : ''} ${!hasCamera ? 'no-camera' : ''}`}>
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                                {!isVideoEnabled && (
                                    <div className="video-disabled-overlay">
                                        <div className="static-overlay"></div>
                                        <div className="video-disabled-content">
                                            <img src="/pigme.png" alt="Pig Me" className="disabled-logo" onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }} />
                                            <p>กล้องปิดอยู่</p>
                                        </div>
                                    </div>
                                )}
                                <div className="no-camera-effect">
                                    <div className="static-overlay"></div>
                                    <div className="no-camera-content">
                                        <img src="/pigme.png" alt="Pig Me" className="effect-logo" onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }} />
                                        <p>ไม่พบกล้อง</p>
                                    </div>
                                </div>
                                <div className="video-label">คุณ</div>
                                <div className="country-flag">
                                    {userConfig.country}
                                    {userConfig.myProvince && ` - ${userConfig.myProvince}`}
                                </div>
                                {!isAudioEnabled && (
                                    <div className="audio-status-self">
                                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                                            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="chat-section">
                            <div className="chat-header">แชท</div>
                            <div className="chat-messages">
                                {messages.map((msg, index) => (
                                    <div key={index} className={`message ${msg.sender}`}>
                                        {msg.sender === 'system' && (
                                            <img src="/pigme.png" alt="Pig Me" className="message-avatar" onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }} />
                                        )}
                                        {msg.sender === 'partner' && msg.country && (
                                            <img
                                                src={`https://flagsapi.com/${getCountryCode(msg.country)}/flat/32.png`}
                                                alt={msg.country}
                                                className="message-avatar"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        )}
                                        {msg.sender === 'me' && (
                                            <img
                                                src={`https://flagsapi.com/${getCountryCode(userConfig.country)}/flat/32.png`}
                                                alt={userConfig.country}
                                                className="message-avatar"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        )}
                                        <div className="message-bubble">{msg.text}</div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>
                            <div className="chat-input-container">
                                <input
                                    type="text"
                                    placeholder="พิมพ์ข้อความ..."
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="chat-input"
                                />
                                <button onClick={handleSendMessage} className="send-btn">
                                    📤
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bottom-controls">
                        <div className="media-controls-container">
                            <button
                                className={`media-btn ${!isAudioEnabled ? 'disabled' : ''}`}
                                onClick={toggleAudio}
                                title={isAudioEnabled ? 'ปิดไมค์' : 'เปิดไมค์'}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                    {isAudioEnabled ? (
                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z M17.3 11c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                                    ) : (
                                        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                                    )}
                                </svg>
                            </button>
                            <button
                                className={`media-btn ${!isVideoEnabled ? 'disabled' : ''}`}
                                onClick={toggleVideo}
                                title={isVideoEnabled ? 'ปิดกล้อง' : 'เปิดกล้อง'}
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                    {isVideoEnabled ? (
                                        <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                                    ) : (
                                        <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
                                    )}
                                </svg>
                            </button>
                        </div>

                        <div className="controls">
                            {isSearching ? (
                                <button className="btn-control btn-cancel" onClick={handleStopSearching}>
                                    ยกเลิก
                                </button>
                            ) : (
                                <>
                                    <button className="btn-control btn-next" onClick={handleNext}>
                                        ถัดไป
                                    </button>
                                    <button className="btn-control btn-stop" onClick={onStop}>
                                        หยุด
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="status">
                        {status}
                        {status.includes('กำลัง') && <span className="loading"></span>}
                    </div>
                </>
            )}
        </div>
    );
}
