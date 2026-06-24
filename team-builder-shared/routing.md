# routing.md — Path-based Zorunlu Routing

> Paylaşılan referans. Sihirbaz (`team-builder-setup`) ve üye rutini (`member-template.md`)
> bu dosyaya dayanır. Üretimde çalışan bir referans kurulumdaki "Zorunlu Routing" tablosunun genelleştirilmiş hâli.

## Amaç

v2 governance modelinin çekirdeği **kod-yolu → zorunlu rol** tablosudur. Generic
"consults" listesi tek başına yeterli değildir; her kod değişikliği görevinde
**hangi yolun hangi role gittiği** açıkça tanımlanır. Bu tablo iki yere yazılır:

1. **CLAUDE.md / AGENTS.md** — okunabilir governance bölümü (insan + agent için).
2. **manifest.routing[]** — makine-okunur kaynak (`{ "path": "<glob>", "role": "<agent-name>" }`).

İkisi `sync-agent-config.mjs` ile aynı kaynaktan (`.agent-source/`) üretilir, böylece
drift olmaz: `project/CLAUDE.md`'deki tablo ile `manifest.routing` elle ayrı tutulmaz.

## Standart satır (her zaman ekle)

- **`docs/**` → architect.** Architect tüm `docs/` dizininin sahibidir; dokümantasyon (ADR, kısıt, tasarım, README) yalnız architect tarafından yazılır. Bu satır routing tablosuna her zaman eklenir (alt klasör — `docs/architecture/adr` vb. — tek tek yazılmaz; `docs/**` yeter).

## Temel Kural (DEĞİŞMEZ)

- **Ajansız doğrudan kod yazma YASAKTIR.** Her kod değişikliği görevinde tablodaki
  zorunlu rol çağrılır.
- **Tabloyu bypass eden doğrudan kod yazımı = mimari ihlaldir.** Eşleşen rol varken
  main agent kodu kendisi yazmaz; ilgili role delege eder.
- **Şüphede kalınırsa architect'e danışılır.** Yol bir role net eşleşmiyorsa, ya da
  mimari karar / breaking change / standart belirsizliği varsa önce architect.

Bu üç madde CLAUDE.md/AGENTS.md'nin routing bölümüne **birebir** (genelleştirilmiş
proje adlarıyla) yazılır. "YASAK" ve "bypass = ihlal" ifadeleri yumuşatılmaz.

## Tablo Mantığı

Tablo satırı: `<glob/yol> → <rol>`. Eşleşme **en özgül (most-specific) yol önce**
değerlendirilir; bir dosya birden fazla satıra uyarsa en dar glob kazanır.

| Satır türü | Örnek (genel) | Hedef rol |
|---|---|---|
| Backend domain yolu | `apps/<app>/main/src/**`, preload | domain backend-developer |
| Frontend domain yolu | `apps/<app>/renderer/src/**`, `packages/ui-kit/**` | domain frontend-developer |
| Modül/eklenti yolu | `modules/<name>/**` (UI dahil) | extension-developer |
| Mimari karar / ADR / breaking change / standart belirsizliği | (yol değil, iş türü) | architect |
| Kod değişikliği tamamlandı, review gerekiyor | (yol değil, kapı) | reviewer |

Son iki satır **yola değil iş türüne** bağlıdır; bunlar generic danışma/gate
kurallarıdır ve her projede korunur (aşağıya bakın).

## Routing satırları PROJEYE ÖZELDİR

Yol→rol satırları **jenerik varsayılmaz**. Sihirbaz şu akışı izler:

1. **Proje analizi:** kod köklerini tarar (`apps/*`, `modules/*`, `packages/*`,
   `src/*` vb.), gerçek domain yapısını çıkarır.
2. **Taslak öner:** analize göre bir routing tablosu taslağı + domain-split developer
   rolleri önerir (örn. `apps/api/**` → `backend-developer`, `apps/web/**` →
   `frontend-developer`, `modules/**` → `extension-developer`).
3. **Kullanıcı onayı:** kullanıcı taslağı onaylar, düzeltir veya satır ekler/siler.
   Hiçbir satır kullanıcı onayı olmadan kesinleşmez.
4. **Yazım:** onaylanan tablo hem `project/CLAUDE.md` (ve hedef Codex ise
   `project/AGENTS.md`) governance bölümüne **hem de** `manifest.routing[]`'e yazılır.

`manifest.routing[].role` değerleri manifest'teki bir `agents[].name` olmalıdır
(`validate-manifest.mjs` bunu doğrular). Tanımsız role işaret eden routing satırı
geçersizdir.

## Korunan generic danışma kuralları

Yol→rol tablosunun **yanında**, projeden bağımsız sabit kurallar her zaman korunur:

- **Architect'e danış:** mimari karar, ADR, kanal/standart belirsizliği, breaking
  change durumunda kod yazmadan önce architect'e gidilir.
- **Reviewer gate:** her kod değişikliği tamamlandıktan sonra reviewer çağrılır
  (review olmadan iş "tamam" sayılmaz).
- **No-workaround → architect:** belirsizlikte kestirme yol aranmaz; architect'e
  gidilir (bkz. `constitution.md` KARAR 1).

Bu kurallar projeye özel routing satırlarıyla **çelişmez, onları tamamlar**: tablo
"kim yazar"ı, danışma kuralları "ne zaman dur ve sor"u belirler.

## Üretim özeti

- Kaynak: `manifest.routing[]` (`.agent-source/agents/manifest.json`).
- Generated hedefler: `CLAUDE.md` + (Codex ise) `AGENTS.md` governance bölümü.
- Doğrulama: `validate-manifest.mjs` — `path` ve `role` dolu, `role` ∈ agent adları.
- Senkron: `sync-agent-config.mjs` her iki çıktıyı tek kaynaktan üretir (drift yok).
