# Oranj Kozmetik Web Sitesi

Bu proje kozmetik sirketi icin hazirlanmis, musteri paneli ve admin paneli iceren bir web uygulamasidir.

## Ozellikler

- Musteri paneli:
  - Urun kesfi ve icerik goruntuleme
  - Sepet, odeme ve kargo takibi
  - Duyuru goruntuleme
- Admin paneli:
  - Kullanici ekleme ve silme
  - Urun/icerik yukleme ve kaldirma
  - Stok, kategori ve siparis yonetimi
  - E-posta gonderme (sistem ici kayit)
  - Duyuru ekleme ve kaldirma
  - Kullanici adi ve sifre degistirme
  - CMS ile site basligi, renkler ve banner ayari

## Kurulum ve Calistirma

1. Proje klasorune girin:

   ```powershell
   cd C:\Users\karak\Desktop\oranj-kozmetik
   ```

2. Sunucuyu calistirin:

   ```powershell
   node server.js
   ```

3. Tarayicida acin:

   `http://localhost:3000`

## Render'a Canli Yayin (Deploy)

1. Projeyi GitHub'a yukleyin.
2. [Render Dashboard](https://dashboard.render.com/) -> **New** -> **Blueprint** veya **Web Service**.
3. GitHub reposunu baglayin (`oranj-kozmetik`).
4. Ayarlar (Blueprint kullanmiyorsaniz):
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/health`
5. **Deploy** tusuna basin.
6. Canli adres: `https://oranj-kozmetik.onrender.com` (servis adina gore degisir).

> Not: Ucretsiz planda sunucu bir sure kullanilmazsa uyur; ilk acilista 30-60 sn bekleyebilirsiniz.
> Veriler `data/db.json` dosyasinda tutulur. Kalici disk icin Render'da paid plan + `DATA_DIR` ortam degiskeni kullanilabilir.

## Varsayilan Giris Bilgileri

- Admin:
  - kullanici adi: `admin`
  - sifre: `admin123`

## Veri Yapisi

- Veritabani dosyasi: `data/db.json`
- Toplam sac boyasi urunu: 30 adet
  - 3 farkli tur (Kalici Krem Boya, Amonyaksiz Boya, Bitkisel Dogal Boya)
  - Her turde 10 farkli boya numarasi (1.0 - 10.0)
