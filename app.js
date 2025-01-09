const axios = require('axios');
const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');
const {
    MessagingResponse
} = require('twilio').twiml;
const app = express();

// Server'ı başlatıyoruz
http.createServer(app).listen(3000, () => {
    console.log('Express server listening on port 3000');
});

// Mesajları saklamak için bir array
let messages = [];

// Body parser middleware'ini kullanarak gelen veriyi alıyoruz
app.use(express.urlencoded({
    extended: false
}));
app.use(express.json());

// Static dosyaları sunmak için public klasörünü kullanıyoruz
app.use(express.static(path.join(__dirname, 'public')));

// Twilio API credentials
const credentials = 'AC9c8a9105cda03c1ab041ab61363c06d0:e10ca68578e17c6bac6229913bedbb42'; // Replace with your Twilio Account SID and Auth Token

// Function to download media from Twilio
async function downloadMedia(mediaUrl) {
    try {
        const mediaResponse = await axios.get(mediaUrl, {
            headers: {
                'Authorization': `Basic ${Buffer.from(credentials).toString('base64')}`,
                'Accept': 'application/json',
            },
            responseType: 'arraybuffer'
        });

        console.log('Media downloaded');
        return mediaResponse.data;
    } catch (error) {
        if (error.response) {
            console.error('Error response data:', error.response.data);
        } else {
            console.error('Error message:', error.message);
        }
        return null;
    }
}

// WhatsApp üzerinden gelen mesajları alacak endpoint
app.post('/sms', async (req, res) => {
    const twiml = new MessagingResponse();

    // Gelen mesajın içeriği
    const message = req.body.Body;
    // Gönderenin numarası
    const from = req.body.From;

    // Medya varsa, medyanın URL'sini al
    const mediaUrl = req.body.MediaUrl0; // Eğer birden fazla medya varsa MediaUrl1, MediaUrl2 vb. kullanılabilir
    const mediaType = req.body.MediaContentType0; // Medyanın türü (örneğin 'image/jpeg', 'audio/mpeg' vb.)

    console.log(message, from);

    // Medya dosyasını indir ve kaydet
    if (mediaUrl) {
        try {
            const mediaBuffer = await downloadMedia(mediaUrl);

            if (mediaBuffer) {
                // Dosyayı kaydetmek için benzersiz bir isim oluştur
                const fileName = `media_${Date.now()}.${mediaType.split('/')[1]}`;
                const filePath = path.join(__dirname, 'public', fileName);

                // Dosyayı kaydet
                fs.writeFileSync(filePath, mediaBuffer);

                // Mesajı kaydet
                messages.push({
                    from,
                    message,
                    mediaUrl: `/${fileName}`, // Dosya yolu, public klasöründen erişilebilir
                    mediaType
                });

                // Medya dosyasını base64 formatına dönüştürüp konsola yazdır
                const base64Data = Buffer.from(mediaBuffer, 'binary').toString('base64');
                console.log(`Image Name: ${fileName}`);
                console.log(`Base64 Encoded Image: ${base64Data}`);
            }
        } catch (error) {
            console.error('Medya indirme hatası:', error);
        }
    } else {
        // Sadece metin mesajı
        messages.push({
            from,
            message
        });
    }

    // Yanıt olarak gelen kişiye teşekkür mesajı gönder
    twiml.message('Thanks for your message!');

    // XML formatında yanıtı gönder
    res.writeHead(200, {
        'Content-Type': 'text/xml'
    });
    res.end(twiml.toString());
});

// Gelen mesajları ve medya dosyalarını gösteren sayfa
app.get('/messages', (req, res) => {
    let html = '<ul class="message-list">';

    messages.forEach(msg => {
        html += `<li class="message-item"><strong>${msg.from}</strong>: ${msg.message}</li>`;

        if (msg.mediaUrl) {
            // Medya türünü kontrol et
            if (msg.mediaType.startsWith('image/')) {
                html += `<li><strong>Medya:</strong><br><img src="${msg.mediaUrl}" alt="Medya" class="media-img" style="max-width: 300px;"></li>`;
            } else if (msg.mediaType.startsWith('video/')) {
                html += `<li><strong>Medya:</strong><br>
                    <video controls style="max-width: 300px;">
                        <source src="${msg.mediaUrl}" type="${msg.mediaType}">
                        Tarayıcınız bu video formatını desteklemiyor.
                    </video>
                </li>`;
            } else {
                html += `<li><strong>Medya:</strong> Desteklenmeyen medya türü (${msg.mediaType})</li>`;
            }
        }
    });

    html += '</ul>';

    res.send(html);
});

// Ana sayfa: index.html dosyasını sunuyoruz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});