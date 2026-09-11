import { useState, useEffect } from 'react';
import SearchableSelect from './SearchableSelect';
import { COUNTRIES, getFlagUrl } from '../data/countries';

interface SetupProps {
    onStart: (config: any) => void;
    detectedCountry: string;
}

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
    'สมุทรสงคร', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุโขทัย',
    'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อ่างทอง',
    'อำนาจเจริญ', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี'
];

export default function Setup({ onStart, detectedCountry }: SetupProps) {
    const [gender, setGender] = useState<string>('male');
    const [preferGender, setPreferGender] = useState<string>('female');
    const [preferCountry, setPreferCountry] = useState<string>('any');
    const [myProvince, setMyProvince] = useState<string>('');
    const [preferProvince, setPreferProvince] = useState<string>('any');

    // โหลดการตั้งค่าจาก localStorage
    useEffect(() => {
        const savedSettings = localStorage.getItem('chatSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                setGender(settings.gender || 'male');
                setPreferGender(settings.preferGender || 'female');
                setPreferCountry(settings.preferCountry || 'any');
                setMyProvince(settings.myProvince || '');
                setPreferProvince(settings.preferProvince || 'any');
            } catch (e) {
                console.error('Error loading settings:', e);
            }
        }
    }, []);

    // อัปเดต preferGender อัตโนมัติเมื่อเลือก gender
    const handleGenderChange = (value: string) => {
        setGender(value);
        if (value === 'male') {
            setPreferGender('female');
        } else if (value === 'female') {
            setPreferGender('male');
        } else {
            setPreferGender('any');
        }
    };

    const handleStart = () => {
        const config = {
            gender,
            preferGender,
            preferCountry,
            myProvince: detectedCountry === 'Thailand' ? myProvince : '',
            preferProvince: detectedCountry === 'Thailand' ? preferProvince : 'any'
        };

        localStorage.setItem('chatSettings', JSON.stringify(config));
        onStart(config);
    };

    // Options สำหรับ dropdown ต่างๆ
    const genderOptions = [
        { value: 'male', label: 'ชาย' },
        { value: 'female', label: 'หญิง' },
        { value: 'other', label: 'อื่นๆ' }
    ];

    const preferGenderOptions = [
        { value: 'male', label: 'ชาย' },
        { value: 'female', label: 'หญิง' },
        { value: 'any', label: 'ทั้งหมด' }
    ];

    const countryOptions = [
        { value: 'any', label: 'ทั้งหมด' },
        ...COUNTRIES.map(country => ({
            value: country.name,
            label: country.nameLocal,
            icon: getFlagUrl(country.code, 24)
        }))
    ];

    const provinceOptions = THAILAND_PROVINCES.map(province => ({
        value: province,
        label: province
    }));

    const preferProvinceOptions = [
        { value: 'any', label: 'ทั้งหมด' },
        ...provinceOptions
    ];

    return (
        <div className="setup-container">
            <div className="setup-card">
                <div className="logo-container">
                    <img src="/pigme.png" alt="Pig Me" className="logo" />
                    <h1>Pig Me</h1>
                </div>

                <div className="form-group">
                    <label>ประเทศของคุณ</label>
                    <div className="country-display">
                        {detectedCountry ? (
                            <>
                                <img
                                    src={getFlagUrl(COUNTRIES.find(c => c.name === detectedCountry)?.code || 'TH', 24)}
                                    alt={detectedCountry}
                                    className="country-flag-icon"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                <span>{COUNTRIES.find(c => c.name === detectedCountry)?.nameLocal || detectedCountry}</span>
                            </>
                        ) : (
                            'กำลังตรวจสอบ...'
                        )}
                    </div>
                </div>

                {detectedCountry === 'Thailand' && (
                    <div className="form-group">
                        <label>จังหวัดของคุณ</label>
                        <SearchableSelect
                            value={myProvince}
                            onChange={setMyProvince}
                            options={provinceOptions}
                            placeholder="พิมพ์เพื่อค้นหาหรือเลือกจังหวัด..."
                        />
                    </div>
                )}

                <div className="form-group">
                    <label>เพศของคุณ</label>
                    <SearchableSelect
                        value={gender}
                        onChange={handleGenderChange}
                        options={genderOptions}
                        placeholder="เลือกเพศ"
                    />
                </div>

                <div className="form-group">
                    <label>ต้องการพบเพศ</label>
                    <SearchableSelect
                        value={preferGender}
                        onChange={setPreferGender}
                        options={preferGenderOptions}
                        placeholder="เลือกเพศที่ต้องการพบ"
                    />
                </div>

                <div className="form-group">
                    <label>ต้องการพบประเทศ</label>
                    <SearchableSelect
                        value={preferCountry}
                        onChange={setPreferCountry}
                        options={countryOptions}
                        placeholder="เลือกประเทศ"
                    />
                </div>

                {detectedCountry === 'Thailand' && preferCountry === 'Thailand' && (
                    <div className="form-group">
                        <label>ต้องการพบจังหวัด</label>
                        <SearchableSelect
                            value={preferProvince}
                            onChange={setPreferProvince}
                            options={preferProvinceOptions}
                            placeholder="เลือกจังหวัด"
                        />
                    </div>
                )}

                <button
                    className="btn-primary"
                    onClick={handleStart}
                    disabled={!detectedCountry || (detectedCountry === 'Thailand' && !myProvince)}
                >
                    เริ่มค้นหา
                </button>

                {detectedCountry === 'Thailand' && !myProvince && (
                    <p className="warning-text">กรุณาเลือกจังหวัดของคุณ</p>
                )}
            </div>
        </div>
    );
}
