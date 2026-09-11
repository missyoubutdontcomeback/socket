'use client';

import { useState, useEffect } from 'react';
import Setup from '@/components/Setup';
import VideoChat from '@/components/VideoChat';

export default function Home() {
    const [userConfig, setUserConfig] = useState<any>(null);
    const [country, setCountry] = useState<string>('');

    useEffect(() => {
        // ตรวจจับประเทศของผู้ใช้
        fetch('https://ipapi.co/json/')
            .then(res => res.json())
            .then(data => {
                setCountry(data.country_name || 'Unknown');
            })
            .catch(() => {
                setCountry('Unknown');
            });
    }, []);

    const handleStartChat = (config: any) => {
        setUserConfig({ ...config, country });
    };

    const handleStopChat = () => {
        setUserConfig(null);
    };

    if (!userConfig) {
        return <Setup onStart={handleStartChat} detectedCountry={country} />;
    }

    return <VideoChat userConfig={userConfig} onStop={handleStopChat} />;
}
