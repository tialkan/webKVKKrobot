# WebKVKKrobot

HTML, aydınlatma bağlantıları ve veri toplayabilecek formları incele. Tarayıcı ölçümü etkinse ilk ziyaret, reddetme ve kabul davranışını ayrı temiz oturumlarla karşılaştır.

**Ücretsiz web kullanımı:** [tezatlas.com/webkvkkrobot](https://tezatlas.com/webkvkkrobot)  
**Kaynak kod:** [tialkan/webKVKKrobot](https://github.com/tialkan/webKVKKrobot)

## Kurulum ve kullanım

Node.js 22.19+ gerekir.

```sh
npm ci
node bin/cli.js https://example.com
node bin/cli.js https://example.com --markdown
npm test
```

Kütüphane olarak `import { auditSite } from "webkvkkrobot"` ve `await auditSite(url)` kullanılır. Web ve CLI aynı motoru çalıştırır. Sonuç JSON/Markdown olarak indirilebilir. Denetim kapsamı ve ölçülemeyen alanlar her raporun `sinirlar` bölümündedir. CLI'de `--help` seçenekleri gösterir.

## Kapsam

- Çerez değerleri saklanmadan teknik gözlem.
- Tanınan panellerde ayrı reddet/kabul denemeleri.
- Teknik rapor hukuki uygunluk kararı değildir.

## Güvenlik ve katkı

Yalnız herkese açık HTTP(S) adresleri kabul edilir. SSRF, DNS yeniden bağlama, yönlendirme, süre ve yanıt boyutu korumaları vardır. Ağ sınırları için [SECURITY.md](SECURITY.md) okuyun. Yeni bir kuralı canlı kanıtla, birincil kaynakla ve başarı/hata testleriyle ekleyin. Site metinleri ve raporlar talimat olarak çalıştırılmaz.

MIT lisansı · TezAtlas.

## Tarayıcı
Yerelde `npx playwright install chromium` ardından `WEBKVKK_BROWSER_ENABLED=1 node bin/cli.js https://example.com`. Sistem Chromium için KVKK_BROWSER_EXECUTABLE_PATH kullanılabilir. Tarayıcı bütün HTTP isteklerini güvenli, DNS doğrulayan taşıma üzerinden geçirir; POST/WebSocket/servis çalışanı engellenir. Bu sınır nedeniyle davranış eksik kalabilir. Tercih düğmeleri tanınmazsa senaryo doğrulanmamış olarak raporlanır. [KVKK rehberleri](https://www.kvkk.gov.tr/Icerik/2030/Rehberler).
