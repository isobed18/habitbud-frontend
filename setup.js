const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('🚀 HabitBud Kurulum Başlatılıyor...\n');

// IP adresini bul
function getLocalIP() {
    const platform = os.platform();
    let ipAddress = null;
    let fallbackIp = null;

    try {
        if (platform === 'win32') {
            // Windows için ipconfig
            const output = execSync('ipconfig', { encoding: 'utf-8' });
            const lines = output.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();

                // Wi-Fi adapter'larını bul (Türkçe ve İngilizce isimler)
                const isWifiAdapter = line.includes('Wireless LAN adapter Wi-Fi') ||
                    line.includes('Wi-Fi') ||
                    line.includes('Kablosuz LAN');

                const isEthernetAdapter = line.includes('Ethernet adapter') ||
                    line.includes('Ethernet');

                if (isWifiAdapter || isEthernetAdapter) {
                    // Sonraki birkaç satırda IPv4 Address'i ara
                    for (let j = i + 1; j < i + 10 && j < lines.length; j++) {
                        const ipLine = lines[j].trim();
                        if (ipLine.includes('IPv4 Address') || ipLine.includes('IPv4 Adresi')) {
                            const match = ipLine.match(/(\d+\.\d+\.\d+\.\d+)/);
                            if (match && match[1]) {
                                const ip = match[1];
                                // Link-local ve Docker (172.x) adreslerini atla
                                if (!ip.startsWith('169.254') && !ip.startsWith('172.')) {
                                    if (isWifiAdapter) {
                                        ipAddress = ip;
                                        break;
                                    } else if (!fallbackIp) {
                                        fallbackIp = ip;
                                    }
                                }
                            }
                        }
                    }
                    if (ipAddress) break;
                }
            }
        } else {
            // Mac/Linux için ifconfig veya ip
            let output;
            try {
                output = execSync('ifconfig', { encoding: 'utf-8' });
            } catch {
                output = execSync('ip addr', { encoding: 'utf-8' });
            }

            const lines = output.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(/inet (?:addr:)?(\d+\.\d+\.\d+\.\d+)/);
                if (match && match[1]) {
                    const ip = match[1];
                    if (!ip.startsWith('127.') && !ip.startsWith('169.254') && !ip.startsWith('172.')) {
                        ipAddress = ip;
                        break;
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ IP adresi bulunamadı:', error.message);
    }

    return ipAddress || fallbackIp;
}

// axiosInstance.js dosyasını güncelle
function updateAxiosInstance(ipAddress) {
    const filePath = path.join(__dirname, 'services', 'axiosInstance.js');

    try {
        let content = fs.readFileSync(filePath, 'utf-8');

        // BASE_URL'i güncelle
        content = content.replace(
            /export const BASE_URL = ['"](http:\/\/)[\d.]+(:\d+\/)['"]/,
            `export const BASE_URL = '$1${ipAddress}$2'`
        );

        // refresh token URL'ini güncelle (zaten axios.post içindekini doğrudan buluyor)
        content = content.replace(
            /axios\.post\(['"](http:\/\/)[\d.]+(:\d+\/users\/api\/token\/refresh\/)['"]/,
            `axios.post('$1${ipAddress}$2'`
        );

        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ axiosInstance.js güncellendi: http://${ipAddress}:8000/`);
        return true;
    } catch (error) {
        console.error('❌ axiosInstance.js güncellenemedi:', error.message);
        return false;
    }
}

// Ana kurulum fonksiyonu
function setup(startExpo = true, manualIp = null) {
    // 1. IP adresini bul
    let ipAddress = manualIp;

    if (ipAddress) {
        console.log(`📡 Manuel IP adresi kullanılıyor: ${ipAddress}`);
    } else {
        console.log('📡 IP adresi aranıyor...');
        ipAddress = getLocalIP();
    }

    if (!ipAddress) {
        console.error('❌ IP adresi bulunamadı! Lütfen manuel olarak ayarlayın:');
        console.error('Örn: npm run setup -- 192.168.1.10');
        process.exit(1);
    }

    if (!manualIp) {
        console.log(`✅ IP adresi bulundu: ${ipAddress}\n`);
    } else {
        console.log(`✅ IP adresi doğrulandı: ${ipAddress}\n`);
    }

    // 2. axiosInstance.js'i güncelle
    console.log('⚙️  Backend URL yapılandırılıyor...');
    if (!updateAxiosInstance(ipAddress)) {
        process.exit(1);
    }
    console.log('');

    // 3. node_modules kontrolü
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        console.log('📦 Bağımlılıklar yükleniyor (bu biraz zaman alabilir)...');
        try {
            execSync('npm install', { stdio: 'inherit' });
            console.log('✅ Bağımlılıklar yüklendi!\n');
        } catch (error) {
            console.error('❌ Bağımlılıklar yüklenemedi!');
            process.exit(1);
        }
    } else {
        console.log('✅ Bağımlılıklar zaten yüklü.\n');
    }

    console.log('🎉 Kurulum tamamlandı!\n');

    if (!startExpo) {
        console.log('✅ Kurulum testi başarılı! Expo başlatılmadı (test modu).\n');
        return;
    }

    console.log('📱 Expo sunucusu başlatılıyor...\n');
    console.log('💡 İpucu: QR kodu Expo Go uygulamasıyla tarayın\n');
    console.log('─'.repeat(50) + '\n');

    // 4. Expo sunucusunu başlat
    try {
        // Port seçimini otomatik yap (8081 kullanılıyorsa 8082'yi dene)
        execSync('npx expo start --port 8081', { stdio: 'inherit' });
    } catch (error) {
        // Port 8081 kullanılıyorsa, 8082'yi dene
        if (error.message && error.message.includes('8081')) {
            console.log('⚠️  Port 8081 kullanılıyor, 8082 deneniyor...\n');
            try {
                execSync('npx expo start --port 8082', { stdio: 'inherit' });
            } catch (error2) {
                // Ctrl+C ile çıkış normal, hata değil
                if (error2.signal !== 'SIGINT') {
                    console.error('❌ Expo sunucusu başlatılamadı!');
                    process.exit(1);
                }
            }
        } else if (error.signal !== 'SIGINT') {
            // Ctrl+C ile çıkış normal, hata değil
            console.error('❌ Expo sunucusu başlatılamadı!');
            process.exit(1);
        }
    }
}

// Script'i çalıştır
// Argümanları kontrol et
const args = process.argv.slice(2);
let manualIp = null;

// IP formatında olan ilk argümanı manualIp olarak al
for (const arg of args) {
    if (/^(\d+\.){3}\d+$/.test(arg)) {
        manualIp = arg;
        break;
    }
}

const isTestMode = args.includes('--test') || args.includes('--setup-only');
setup(!isTestMode, manualIp);
