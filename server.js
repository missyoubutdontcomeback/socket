const { createServer } = require('http');
const { Server } = require('socket.io');

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:3000", "https://pigme-debloy.vercel.app", "https://socket-production-686f.up.railway.app"],
        methods: ["GET", "POST"]
    }
});

// เก็บข้อมูลผู้ใช้ที่กำลังรอจับคู่
const waitingUsers = [];
// เก็บข้อมูลคู่ที่กำลัง chat อยู่
const activePairs = new Map();
// เก็บ fingerprint ที่เชื่อมต่ออยู่เพื่อป้องกัน multi-tab
const connectedFingerprints = new Map();

// ฟังก์ชันส่งจำนวนคนออนไลน์
function broadcastOnlineCount() {
    const onlineCount = connectedFingerprints.size;
    console.log('Broadcasting online count:', onlineCount, 'unique users');
    io.emit('online-count', onlineCount);
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // รอรับ fingerprint ก่อน
    socket.on('register-fingerprint', (fingerprint) => {
        // ตรวจสอบว่า fingerprint นี้เชื่อมต่ออยู่แล้วหรือไม่
        if (connectedFingerprints.has(fingerprint)) {
            const existingSocketId = connectedFingerprints.get(fingerprint);
            console.log('Duplicate connection detected for fingerprint:', fingerprint);

            // ปิด connection เดิม
            const existingSocket = io.sockets.sockets.get(existingSocketId);
            if (existingSocket) {
                existingSocket.emit('duplicate-connection');
                existingSocket.disconnect(true);
            }
        }

        // บันทึก fingerprint และ socket id
        socket.fingerprint = fingerprint;
        connectedFingerprints.set(fingerprint, socket.id);

        console.log('Registered fingerprint:', fingerprint, 'Total unique users:', connectedFingerprints.size);

        // ส่งจำนวนคนออนไลน์ทันทีหลังจากลงทะเบียน
        broadcastOnlineCount();
    });

    // รับข้อมูลผู้ใช้และหาคู่
    socket.on('find-partner', (userData) => {
        console.log('Finding partner for:', socket.id, userData);

        socket.userData = userData;

        // หาคู่ที่ match กับเงื่อนไข
        const matchIndex = waitingUsers.findIndex(user => {
            // เช็คว่าเพศของแต่ละคนตรงกับที่อีกฝ่ายต้องการหรือไม่
            const myGenderMatchesTheirPreference =
                user.userData.preferGender === 'any' ||
                userData.gender === user.userData.preferGender;

            const theirGenderMatchesMyPreference =
                userData.preferGender === 'any' ||
                user.userData.gender === userData.preferGender;

            const genderMatch = myGenderMatchesTheirPreference && theirGenderMatchesMyPreference;

            // เช็คประเทศ
            const countryMatch =
                userData.preferCountry === 'any' ||
                user.userData.preferCountry === 'any' ||
                userData.country === user.userData.preferCountry ||
                user.userData.country === userData.preferCountry;

            // เช็คจังหวัด (สำหรับคนไทย)
            let provinceMatch = true;
            if (userData.country === 'Thailand' && user.userData.country === 'Thailand') {
                // ถ้าทั้งสองฝ่ายเป็นคนไทย ให้เช็คจังหวัด
                if (userData.preferProvince !== 'any' || user.userData.preferProvince !== 'any') {
                    const myProvinceMatchesTheirPreference =
                        user.userData.preferProvince === 'any' ||
                        userData.myProvince === user.userData.preferProvince;

                    const theirProvinceMatchesMyPreference =
                        userData.preferProvince === 'any' ||
                        user.userData.myProvince === userData.preferProvince;

                    provinceMatch = myProvinceMatchesTheirPreference && theirProvinceMatchesMyPreference;
                }
            }

            return genderMatch && countryMatch && provinceMatch;
        });

        if (matchIndex !== -1) {
            // พบคู่ที่เหมาะสม
            const partner = waitingUsers.splice(matchIndex, 1)[0];

            // สร้าง room
            const roomId = `room-${Date.now()}`;
            socket.join(roomId);
            partner.join(roomId);

            // บันทึกคู่
            activePairs.set(socket.id, { partnerId: partner.id, roomId });
            activePairs.set(partner.id, { partnerId: socket.id, roomId });

            console.log('✅ Matched:', socket.id, 'with', partner.id);

            // แจ้งทั้งสองฝ่ายว่าพบคู่แล้ว
            socket.emit('partner-found', {
                partnerId: partner.id,
                roomId,
                partnerCountry: partner.userData.country,
                partnerProvince: partner.userData.myProvince || ''
            });

            partner.emit('partner-found', {
                partnerId: socket.id,
                roomId,
                partnerCountry: userData.country,
                partnerProvince: userData.myProvince || ''
            });

            // ให้ฝั่งที่เข้ามาทีหลัง (socket) เป็นคนสร้าง offer
            setTimeout(() => {
                console.log('📞 Asking', socket.id, 'to make offer');
                socket.emit('make-offer');
            }, 100);
        } else {
            // ยังไม่พบคู่ ให้รอในคิว
            console.log('No match found, adding to queue:', socket.id);
            waitingUsers.push(socket);
            socket.emit('waiting');
            console.log('Current waiting users:', waitingUsers.length);
        }
    });

    // WebRTC signaling
    socket.on('offer', (data) => {
        const pair = activePairs.get(socket.id);
        if (pair) {
            console.log('📤 Forwarding offer from', socket.id, 'to', pair.partnerId);
            io.to(pair.partnerId).emit('offer', data);
        }
    });

    socket.on('answer', (data) => {
        const pair = activePairs.get(socket.id);
        if (pair) {
            console.log('📤 Forwarding answer from', socket.id, 'to', pair.partnerId);
            io.to(pair.partnerId).emit('answer', data);
        }
    });

    socket.on('ice-candidate', (data) => {
        const pair = activePairs.get(socket.id);
        if (pair) {
            io.to(pair.partnerId).emit('ice-candidate', data);
        }
    });

    // Chat message
    socket.on('chat-message', (data) => {
        const pair = activePairs.get(socket.id);
        if (pair) {
            console.log('💬 Forwarding message from', socket.id, 'to', pair.partnerId);
            io.to(pair.partnerId).emit('chat-message', data);
        }
    });

    // Video toggle
    socket.on('video-toggle', (data) => {
        const pair = activePairs.get(socket.id);
        if (pair) {
            console.log('📹 Forwarding video toggle from', socket.id, 'to', pair.partnerId);
            io.to(pair.partnerId).emit('video-toggle', data);
        }
    });

    // Audio toggle
    socket.on('audio-toggle', (data) => {
        const pair = activePairs.get(socket.id);
        if (pair) {
            console.log('🎤 Forwarding audio toggle from', socket.id, 'to', pair.partnerId);
            io.to(pair.partnerId).emit('audio-toggle', data);
        }
    });

    // ข้ามไปหาคนใหม่
    socket.on('next', () => {
        handleDisconnect(socket, true);
    });

    // หยุดการค้นหา
    socket.on('stop-searching', () => {
        const waitingIndex = waitingUsers.findIndex(u => u.id === socket.id);
        if (waitingIndex !== -1) {
            waitingUsers.splice(waitingIndex, 1);
            console.log('User stopped searching:', socket.id);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnecting:', socket.id);

        // ลบ fingerprint
        if (socket.fingerprint) {
            connectedFingerprints.delete(socket.fingerprint);
            console.log('Removed fingerprint:', socket.fingerprint, 'Remaining users:', connectedFingerprints.size);
        }

        handleDisconnect(socket, false);

        // ส่งจำนวนคนออนไลน์หลังจาก disconnect
        broadcastOnlineCount();
    });
});

function handleDisconnect(socket, findNext) {
    console.log('User disconnected:', socket.id);

    // ลบออกจากคิวรอ
    const waitingIndex = waitingUsers.findIndex(u => u.id === socket.id);
    if (waitingIndex !== -1) {
        waitingUsers.splice(waitingIndex, 1);
    }

    // แจ้งคู่ว่า partner disconnect
    const pair = activePairs.get(socket.id);
    if (pair) {
        io.to(pair.partnerId).emit('partner-disconnected');
        activePairs.delete(socket.id);
        activePairs.delete(pair.partnerId);
    }

    if (findNext && socket.userData) {
        // หาคู่ใหม่
        socket.emit('finding-partner');
    }
}

const PORT = 3001;
httpServer.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);

    // อัปเดตจำนวนคนออนไลน์ทุก 5 วินาที
    setInterval(() => {
        broadcastOnlineCount();
    }, 5000);
});
