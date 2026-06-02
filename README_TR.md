# HabitBud 🌱 - React Native Mobil Uygulaması

Bu proje, React Native (Expo) ve Django backend kullanılarak geliştirilmiş, 3B avatar entegrasyonlu ve sosyal doğrulamalı bir alışkanlık takip (habit tracking) mobil uygulamasıdır.

## 🌟 Öne Çıkan UI/UX Özellikleri

- **🐻 3B Avatar Tasarım Stüdyosu (`AvatarStudio.js` & `Avatar3D.js`)**:
  - **Expo GL** ve **React Three Fiber (R3F)** teknolojileriyle güçlendirilmiş entegre 3B model görüntüleyici.
  - **Plushify Shading Filtresi**: Modellerdeki pürüzleri ve metalik yansımaları otomatik sönümleyerek (roughness: `0.85`, metalness: `0`) ve normal haritalarını hesaplayarak maskotlara pürüzsüz, yumuşak kadifemsi bir "oyuncak peluş" görünümü kazandırır.
  - **Eylemsizlik (Inertia) Bazlı Döndürme**: PanResponder ile sürüklenen model, parmak bırakıldığında hıza bağlı olarak kaymaya ve yumuşak şekilde durmaya devam eder (sönümleme çarpanı `0.94`).
  - **Canlı Nefes ve Sallanma Efektleri**: Karakterler boşta dururken nefes alma (`Math.sin` dalgalı boyut değişimi), zıplama ve kafa eğme hareketleri sergiler.
  - **Akıllı Bağlantı Noktaları (Anchors)**: Alınan aksesuarları (şapka, kulaklık, dambıl, asa) modelin lokal alanındaki ilgili noktalara (`head`, `face`, `hand`, `back`, `neck`) yerleştirir.
- **✨ Mikro-ödül Efektleri (`RewardOverlay.js`)**:
  - **Uçan Ödül Çipleri**: Kazanılan ödülleri animasyonlu kartlar halinde (`+15 XP` amber mavi gölgeli, `+5 💎` neon cyan gölgeli) yay fiziği ve kuadratik sönümleme ile ekranın sağ altından yukarı doğru uçurur.
  - **Pulsing Toplam Sayaçları**: Çipler yok olduğunda XP ve Elmas göstergelerini yay fiziğiyle büyüterek (`scale: 1.25` spring) güncellemeyi vurgular.
  - **Kutlama Konfetisi**: Görev tamamlanma anında tam ekran Lottie konfeti şelalesi oynatır.
- **🎬 Lottie Animasyon Entegrasyonu**:
  - `success.json` (günlük check-in onay işareti), `fire.json` (canlı yanan seri ateşi), `trophy_unlock.json`/`badge_unlock.json` (başarımlar ve kilit açılma anları).
- **📳 Zengin Dokunsal Geri Bildirim (Haptics)**:
  - Alışkanlık tamamlama, eşya takıp çıkarma, kaydetme başarı veya hatalarında farklı titreşim profilleri (`light`, `medium`, `success`, `error`, `selection`) kullanılır.
- **📸 Snapchat Tarzı Kanıt Gönderimi ve Geri Al Barı (`SubmitProof.js`)**:
  - Kamera ve galeriden kanıt görseli yükleme, **4.5 saniyelik görsel Geri Al (Undo) sayacı** ile gönderimi son anda iptal edebilme imkanı.
- **💬 Profil Bağlantılı Sohbet (`Chat.js`)**:
  - Kullanıcı avatarlarına ve sohbet başlıklarına tıklandığında anında o kişinin alışkanlık profil sayfasına yönlendiren Snapchat/Instagram tarzı sohbet ekranı.

## Ön Gereksinimler
- Node.js (v14 veya üzeri)
- npm veya yarn
- Expo CLI
- Mobil cihazınızda Expo Go uygulaması kurulu olmalı

### 🚀 Hızlı Kurulum (Önerilen)

Kurulum betiği otomatik olarak:
- Yerel IP adresinizi bulur (Wi-Fi öncelikli)
- Backend URL'ini yapılandırır
- Bağımlılıkları yükler
- Expo sunucusunu başlatır

```bash
# Repoyu klonlayın
git clone https://github.com/isobed18/habitchatF.git
cd habit_f

# Otomatik kurulumu çalıştırın
npm run setup
```

**Manuel IP Yapılandırması (Otomatik bulma başarısız olursa):**
Betik doğru Wi-Fi IP'nizi bulamazsa, manuel olarak belirtebilirsiniz:

1. Terminalde `ipconfig` komutunu çalıştırın.
2. **Wireless LAN adapter Wi-Fi** başlığı altındaki **IPv4 Address** değerini bulun.
3. IP adresini parametre olarak vererek kurulumu başlatın:
   ```bash
   npm run setup -- 192.168.1.10
   ```

---

Backend kurulup çalışır duruma geldikten sonra, frontend kurulumuna devam edin:

1. Bu repoyu klonlayın:
```bash
git clone https://github.com/isobed18/habitchatF.git
cd habit_f
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. Yerel IP Adresinizi Bulun:

**⚠️ Önemli**: Fiziksel cihazda Expo Go kullanırken `localhost` çalışmaz. Telefonunuzun bilgisayarınıza bağlanabilmesi için bilgisayarınızın yerel IP adresini kullanmanız gerekir.

#### Windows:
1. Komut İstemi (CMD) veya PowerShell'i açın
2. `ipconfig` yazın ve Enter'a basın
3. Aktif ağ bağdaştırıcınızın altında (genellikle "Wireless LAN adapter Wi-Fi" veya "Ethernet adapter") **IPv4 Address** kısmını bulun
4. IP adresini kopyalayın (örn: `192.168.1.6`)

#### Mac/Linux:
1. Terminal'i açın
2. `ifconfig` (Mac) veya `ip addr` (Linux) yazın
3. `en0` (Wi-Fi) veya `eth0` (Ethernet) altındaki `inet` adresini bulun
4. IP adresini kopyalayın (örn: `192.168.1.6`)

4. API URL'ini (baseURL) Yapılandırın:

`services/axiosInstance.js` dosyasını düzenleyin ve `baseURL` kısmındaki IP adresini kendi **Yerel IPv4 adresinizle** (3. adımda bulduğunuz IP) değiştirin:

```javascript
// services/axiosInstance.js
const axiosInstance = axios.create({
    baseURL: 'http://IPV4_ADRESINIZ:8000/', // örn: 'http://192.168.1.6:8000/'
    timeout: 30000,
});
```

**Not**: 
- `YEREL_IP_ADRESINIZ` kısmını 3. adımda bulduğunuz IP adresiyle değiştirin
- Backend sunucunuzun 8000 portunda çalıştığından emin olun (farklı bir port kullanıyorsanız onu yazın)
- Bilgisayarınız ve telefonunuz aynı Wi-Fi ağında olmalıdır
- IP adresiniz değişirse (örneğin Wi-Fi'ye yeniden bağlandığınızda), bu dosyayı tekrar güncellemeniz gerekir

5. Geliştirme sunucusunu başlatın:
```bash
npx expo start
```

**Not**: Başlattıktan sonra terminalde bir QR kod göreceksiniz. Telefonunuz ve bilgisayarınızın aynı Wi-Fi ağında olduğundan emin olun.

6. Cihazınızda Çalıştırın:

#### Seçenek A: Fiziksel Cihaz (Test için Önerilen)
1. Mobil cihazınıza **Expo Go** uygulamasını App Store (iOS) veya Play Store (Android)'dan yükleyin
2. **Önemli**: Telefonunuz ve bilgisayarınızın aynı Wi-Fi ağında olduğundan emin olun
3. QR kodu tarayın:
   - **iOS**: Yerleşik Kamera uygulamasını kullanarak QR kodu tarayın
   - **Android**: Expo Go uygulamasının yerleşik QR tarayıcısını kullanın
4. Uygulama cihazınızda açılacaktır
5. Bağlantı sorunu yaşarsanız kontrol edin:
   - `axiosInstance.js` dosyasındaki IP adresinin mevcut ağ IP'nizle eşleştiğini
   - Backend sunucunuzun çalıştığını ve erişilebilir olduğunu
   - Her iki cihazın da aynı ağda olduğunu

#### Seçenek B: iOS Simülatör (Sadece Mac)
```bash
# expo start sonrası terminalde 'i' tuşuna basın
```

#### Seçenek C: Android Emülatör
```bash
# expo start sonrası terminalde 'a' tuşuna basın
# Android Studio emülatörünün çalıştığından emin olun
```

## Önemli Notlar
- Frontend'i başlatmadan önce backend sunucusunun çalıştığından emin olun
- Frontend ve backend aynı ağda olmalıdır
- IP adresiniz değişirse (örneğin Wi-Fi'ye yeniden bağlandığınızda), `services/axiosInstance.js` dosyasındaki IP adresini güncellemeyi unutmayın
- Geliştirme sürecinde hem frontend hem de backend aynı anda çalışıyor olmalıdır
- API bağlantı hataları alırsanız, şunları kontrol edin:
  1. `services/axiosInstance.js` dosyasındaki IP adresiniz doğru mu? (`ipconfig` ile kontrol edin)
  2. Backend sunucusu çalışıyor mu?
  3. Backend sunucusuyla aynı ağda mısınız?
  4. Firewall backend portunu engelliyor mu?

## 🐛 Sorun Giderme

### Bağlantı Sorunları

**Sorun**: Expo Go geliştirme sunucusuna bağlanamıyor
- **Çözüm**: 
  - Her iki cihazın da aynı Wi-Fi ağında olduğunu doğrulayın
  - Firewall'un bağlantıyı engellemediğini kontrol edin
  - Expo geliştirme sunucusunu yeniden başlatmayı deneyin

**Sorun**: Uygulama backend API'ye ulaşamıyor
- **Çözüm**:
  - `services/axiosInstance.js` dosyasındaki IP adresinin mevcut ağ IP'nizle eşleştiğini doğrulayın
  - `ipconfig` (Windows) veya `ifconfig` (Mac/Linux) komutuyla mevcut IP'nizi kontrol edin
  - Backend sunucunuzun çalıştığından emin olun
  - Backend URL'ini tarayıcıda test edin: `http://IP_ADRESINIZ:8000/`

**Sorun**: IP adresi sürekli değişiyor
- **Çözüm**: 
  - Router'ınızda geliştirme makineniz için statik IP ayarlamayı düşünün
  - Veya test için `ngrok` gibi bir araç kullanın (sadece test için)

## Kullanılabilir Komutlar
- `npx expo start` - Expo geliştirme sunucusunu başlatır
- `npx expo start --android` - Uygulamayı Android'de çalıştırır
- `npx expo start --ios` - Uygulamayı iOS'ta çalıştırır
- `npx expo start --web` - Uygulamayı web tarayıcısında çalıştırır

## Proje Yapısı
- `/assets` - Resimler ve diğer statik dosyalar
- `/HomeModals` - Ana ekran için modal bileşenler
- `/services` - API ve diğer servisler
- `/utils` - Yardımcı fonksiyonlar

## Katkıda Bulunma
1. Repoyu Fork'layın
2. Yeni bir branch oluşturun
3. Değişikliklerinizi commit edin
4. Branch'inize push edin
5. Yeni bir Pull Request oluşturun 