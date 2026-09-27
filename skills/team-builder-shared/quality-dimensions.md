# quality-dimensions.md — Kalite Odakları (checkbox)

> Paylaşılan referans. Sihirbaz, "bu projede hangi kalite boyutları önemli?" diye
> **checkbox ile** seçtirir. Seçilenler somut **kısıtlara** (constraints) + **reviewer
> denetim eksenlerine** dönüşür; bazıları rol/skill önerir. `manifest.focus[]`'a yazılır.

## Nasıl sorulur (SADE + ≤4 seçenek kuralı)
- Kullanıcıya "Bu projede hangi kalite boyutlarına özellikle odaklanalım?" diye **çoklu seçim** sun.
- **AskUserQuestion sınırı: soru başına en fazla 4 seçenek.** 6 boyut var → **iki gruba böl**
  (ör. Grup 1: Performans, Kod tasarımı, UI/UX, Güvenlik · Grup 2: Erişilebilirlik, Test/kalite)
  ya da düz metin checklist olarak sun.
- Proje analizine göre **öner** (örn. UI ağırlıklı projede UI/UX + erişilebilirlik; finans/iOS'ta performans + kod tasarımı + test). Kullanıcı seçer; alan adı (`focus`) gösterme.

## Boyutlar → somut çıktı

### 1. Performans  (`performance`)
- **Reviewer ekseni:** pahalı döngü/render, gereksiz yeniden hesap/re-render, memory leak (temizlenmeyen listener/timer/observer), N+1, gereksiz ağ çağrısı, ana iş parçacığını bloklama.
- **Stack'e göre:** Swift/SwiftUI → gereksiz `body` re-eval, `@Observable`/diffing, Instruments; Web → bundle/CWV, render churn; Backend → sorgu/index.
- Constraint (opsiyonel): ağır işler arka planda; ana thread'de I/O yok.

### 2. Kod tasarımı / sürdürülebilirlik  (`code-design`)
- **Constraint (önerilir):** **büyüyen dosyalara izin verme** — `docs/<arch-root>/constraints/file-size.md`: bir dosya **max <N> satır** (varsayılan **800**; kullanıcıya sor), fonksiyon **< ~50 satır**, iç içe **> 4** seviye yok, kopya kod (DRY), tek sorumluluk (SOLID).
- **Reviewer ekseni:** dosya/fonksiyon büyüklüğü, derin nesting, duplication, isimlendirme, ölü kod. Eşik aşımı → Uyarı; aşırıysa Kritik.
- Not: kullanıcı CLAUDE.md/coding-style'ında zaten bir limit varsa onu kullan.

### 3. UI / UX tasarımı  (`ui-ux`)
- **Reviewer ekseni:** tasarım tutarlılığı, design tokens (renk/spacing/tipografi sabitleri), hover/focus/active durumları, hiyerarşi, "template görünümü"nden kaçınma.
- **Rol/skill önerisi:** UI developer rolü + `frontend-design`/`frontend-patterns` (web) veya `swift-architecture-performance` (SwiftUI) skill'i (mandatory aday).

### 4. Erişilebilirlik  (`accessibility`)
- **Reviewer ekseni:** WCAG AA, klavye navigasyonu, renk kontrastı, semantik yapı, ekran okuyucu etiketleri, dokunma hedefi boyutu. (UI/UX'in yakın akrabası; ayrı seçilebilir.)
- Skill önerisi (varsa): erişilebilirlik denetim skill'i.

### 5. Güvenlik  (`security`)
- **Constraint:** sırlar kodda tutulmaz (env/secret manager); girdi doğrulama sınırda; least-privilege.
- **Reviewer ekseni:** secrets, input validation, auth/authz, injection/XSS/SSRF, güvenli kripto, hassas veri loglama.
- **Rol önerisi:** `security` (reviewer) rolü; skill `security-review`.

### 6. Test / kalite  (`testing`)
- **Constraint:** kritik yollar için test; coverage hedefi (varsayılan **%80**, kullanıcıya sor).
- **Reviewer ekseni:** yeni mantık için test var mı, davranış testi (mock değil), kırılgan test.
- **Rol/skill önerisi:** `qa` rolü; skill `tdd-workflow`/`e2e-testing` (stack'e göre `*-testing`).

> Katalog sabit değil; stack/proje gereğine göre uyarla. Seçilmeyen boyut için kural/eksen üretme (YAGNI).

## Üretime yansıma
1. Seçilenleri `manifest.focus[]`'a yaz (örn. `["performance","code-design","security"]`).
2. **Reviewer agent md'sine** seçili boyutların denetim eksenlerini ekle (agent-md-rich.md → reviewer "Denetim Eksenleri").
3. **Somut kısıt üretilenler** için (`code-design` → file-size, `security` → secrets, `testing` → coverage) `docs/<arch-root>/constraints/<konu>.md`'yi `templates/constraint.md` standardıyla oluştur (eşik/orantıyı kullanıcıya sor).
4. UI/güvenlik/test boyutları, roller adımında ilgili opsiyonel rolü/skili önerme gerekçesidir.
