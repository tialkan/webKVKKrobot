import {
  start,
  load,
  squeeze,
  publicLink,
  finding,
  report,
  section,
  assertHtml,
} from "./common.js";
export function staticPrivacy(html, url, cookies = []) {
  const $ = load(html);
  const findings = [];
  const rows = [];
  const external = new Set();
  const notices = [];
  $("script[src],iframe[src],img[src],link[href]").each((_, el) => {
    const u = publicLink($(el).attr("src") || $(el).attr("href"), url);
    if (u && u.origin !== new URL(url).origin) external.add(u.origin);
  });
  $("a[href]").each((_, el) => {
    const name = squeeze($(el).text());
    if (/aydınlatma|gizlilik|privacy|kişisel veri|çerez|cookie/i.test(name)) {
      const u = publicLink($(el).attr("href"), url);
      if (u)
        notices.push({
          etiket: name,
          deger: "Bağlantı bulundu; metnin hukuki yeterliliği ölçülmedi.",
          url: u.href,
        });
    }
  });
  if (!notices.length)
    findings.push(
      finding(
        "KVKK-NOTICE",
        "Aydınlatma/gizlilik bağlantısı kaynakta bulunamadı",
        url,
        "Bağlantı etiketi eşleştirilemedi.",
        "Kişisel veri işleme faaliyetlerini belirleyin ve gerekli aydınlatmayı erişilebilir sunun. Bağlantı adı farklıysa elle doğrulayın.",
        "bilgi",
      ),
    );
  if (
    $("form input:not([type=hidden]),form textarea").length &&
    !notices.length
  )
    findings.push(
      finding(
        "KVKK-FORM",
        "Veri toplayabilecek form için aydınlatmayı inceleyin",
        url,
        `${$("form").length} form`,
        "Formun topladığı kişisel veriler ve aydınlatma yöntemini değerlendirin.",
      ),
    );
  rows.push(
    ...notices,
    ...[...external].map((u) => ({
      etiket: "HTML'de üçüncü taraf kaynak",
      deger: "Beyan edilen kaynak; gerçek ağ isteği değildir.",
      url: u,
    })),
    ...cookies.map((c) => ({ etiket: "HTTP Set-Cookie", deger: c })),
  );
  return { findings, rows };
}
export async function auditSite(input, options = {}) {
  const { target, started, response, signal } = await start(input, options);
  assertHtml(response);
  const { findings, rows } = staticPrivacy(
    response.body,
    response.url,
    response.cookies,
  );
  const sections = [
    section(
      "HTML ve HTTP gözlemleri",
      rows.length
        ? rows
        : [
            {
              etiket: "Durum",
              deger: "Bu kurallar kapsamında işaret bulunamadı.",
            },
          ],
    ),
  ];
  let snapshots = null,
    error = "";
  if (options.browserScanner)
    snapshots = await options.browserScanner(response.url, { signal });
  else if (process.env.WEBKVKK_BROWSER_ENABLED === "1")
    try {
      const { browserScan } = await import("./browser.js");
      snapshots = await browserScan(response.url, { signal });
    } catch {
      error =
        "Tarayıcı ölçümü başlatılamadı veya tamamlanamadı; HTML gözlemleri korunmuştur.";
    }
  else
    error =
      "Tarayıcı ölçümü sunucuda etkin değil. Çerez tercihlerinin gerçek etkisi ölçülemedi.";
  if (snapshots) {
    for (const s of snapshots) {
      sections.push(
        section(`Tarayıcı · ${s.choice}`, [
          {
            etiket: "Etkileşim",
            deger:
              s.error ||
              (s.choice === "ilk ziyaret"
                ? "Temiz oturumla açıldı"
                : s.clicked
                  ? "Tercih düğmesine basıldı"
                  : "Tek ve tanınan tercih düğmesi bulunamadı; bu senaryo doğrulanamadı."),
          },
          {
            etiket: "Engellenen istek",
            deger: `${s.blocked} · POST/WebSocket veya ağ/boyut/süre sınırı`,
          },
          ...s.cookies.map((c) => ({
            etiket: "Çerez adı (değer saklanmaz)",
            deger: `${c.name} · ${c.domain} · Secure: ${c.secure} · SameSite: ${c.sameSite}`,
          })),
          ...s.storage.local.map((name) => ({
            etiket: "LocalStorage anahtarı",
            deger: name,
          })),
          ...s.storage.session.map((name) => ({
            etiket: "SessionStorage anahtarı",
            deger: name,
          })),
          ...[...new Set(s.requests.map((r) => r.url))].map((url) => ({
            etiket:
              new URL(url).origin === new URL(response.url).origin
                ? "Birinci taraf istek"
                : "Üçüncü taraf istek",
            deger: "İstek gözlendi (engellenmiş istekler de dahil)",
            url,
          })),
        ]),
      );
    }
    const initial = snapshots.find((s) => s.choice === "ilk ziyaret"),
      reject = snapshots.find((s) => s.choice === "reddet"),
      accept = snapshots.find((s) => s.choice === "kabul et");
    if (
      initial &&
      !initial.error &&
      reject?.clicked &&
      !reject.error &&
      accept?.clicked &&
      !accept.error
    ) {
      const keys = (s) =>
        new Set(s.cookies.map((c) => `${c.domain}:${c.name}`));
      const i = keys(initial),
        r = keys(reject),
        a = keys(accept);
      sections.push(
        section("Tercih karşılaştırması", [
          {
            etiket: "İlk ziyaret / reddet / kabul çerez sayısı",
            deger: `${i.size} / ${r.size} / ${a.size}`,
          },
          {
            etiket: "Reddetmede kalıp kabulde de bulunan",
            deger: [...r].filter((k) => a.has(k)).join(", ") || "Yok",
          },
          {
            etiket: "Yorum",
            deger:
              "Aynı çerezin kalması tek başına ihlal değildir. Amaç, gereklilik ve hukuki sebep ayrıca doğrulanmalıdır.",
          },
        ]),
      );
    }
  } else
    sections.push(
      section("Tarayıcı ölçümü", [{ etiket: "Durum", deger: error }]),
    );
  return report("WebKVKKrobot", target, started, findings, sections, [
    "Teknik gözlemler hukuki uygunluk kararı veya sertifika değildir. Çerez olmasa da diğer kişisel veri işleme faaliyetleri aydınlatma gerektirebilir.",
    "Çerez amaçları otomatik belirlenmez; üçüncü taraf istek tek başına ihlal anlamına gelmez.",
    "Tarayıcı üç temiz oturumla yalnız tanınan tercih düğmelerini dener. Tanınmayan panelde reddet/kabul doğrulanmış sayılmaz.",
    "POST, WebSocket, servis çalışanları ve sınırı aşan kaynaklar engellenir; bu nedenle bazı izleme davranışları eksik kalabilir.",
    "Çerez değerleri ve depolama değerleri rapora veya günlüğe yazılmaz. Bekleme süreleri sınırlıdır; gecikmeli davranışlar gözden kaçabilir.",
  ]);
}
