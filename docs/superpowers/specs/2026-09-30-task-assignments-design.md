# Tasarım: İş başına araç ataması (task assignments)

- **Tarih:** 2026-09-30
- **Durum:** Taslak
- **Kapsam:** Plan kapısı açık bir projede, bir işin rollerinin (işi yapan, plan denetimi, kod
  denetimi, danışılan roller) hangi araçta (Claude / Codex / OpenCode) çalışacağını iş başına
  kullanıcının seçmesi; seçilmeyenlerin çalışma anında proje varsayılanıyla çözülmesi; dış
  çağrılarda rolün modelinin uygulanması; kurulu projelerin `work-plan` skill'ini yenileme.

## Problem

1. `executor` plana yazılırken o anki oturumun aracıyla dondurulur (`claude/backend-developer`).
   Kullanıcı başka araç seçemez; seçmediğinde de "o anki araç" kalıcı olur.
2. Denetim aracı yalnız proje geneli `crossReview` ile değişir; iş başına seçilemez.
3. Danışma (`consults`) hep aynı araçta yapılır; architect'in hangi araçta çalışacağı seçilemez.
4. Dış çağrılar CLI'ın varsayılan modeliyle koşar; `llm.json`'daki rol modeli uygulanmaz.
5. Kurulu projelerin `work-plan` skill'i kurulum anındaki şablondan üretilmiştir; yeni kurallar
   onlara ulaşmaz.

## Kararlar

### K1 — Açılıp kapanan proje ayarı

`planGate.taskAssignments` (isteğe bağlı boolean, yoksa `false`).
- **Kapalı:** hiçbir şey sorulmaz; her rol çalışma anında proje varsayılanıyla çözülür (K3).
  Planlardaki `assignments` alanı **yok sayılır** (silinmez; yeniden açılınca geçerli olur).
- **Açık:** plan netleşince atama tablosu gösterilir (K4).
- Setup (7C) birden çok hedef seçildiyse sorar; upgrade istendiği an açar/kapatır.
- Doğrulayıcı: boolean değilse hata.

### K2 — Plan biçimi: dondurma yok

- `executor: <agent-adı>` — yalnız ad. Aracı plana **yazılmaz**.
- Eski biçim `executor: <ekosistem>/<agent-adı>` okunmaya devam eder ve **açık bir atama**
  gibi davranır (eski planların davranışı değişmez).
- Yeni, isteğe bağlı alan — yalnız kullanıcının **açıkça seçtikleri**:
  ```yaml
  assignments:
    executor: codex
    plan-review: claude
    code-review: opencode
    consult:
      architect: codex
  ```
  Olmayan anahtar = varsayılan. Değer, o rolün etkin hedeflerinden biri olmalıdır.
- `assignments` değişikliği `revision` **artırmaz**: planın içeriği değil, kimin çalıştığıdır;
  mevcut onayları geçersiz kılmaz. Sonraki denetim kayıtları yine gerçekte **koştuğu**
  ekosistemi `by:`'a yazar.
- `executor` adının değişmesi bugünkü gibi `revision` artırır.

### K3 — Varsayılanlar (çalışma anında çözülür)

| Rol | Varsayılan araç |
|---|---|
| İşi yapan | Oturumun aracı, rol orada üretiliyorsa; değilse rolün etkin hedeflerinin ilki |
| Plan / kod denetimi | Bugünkü kural: `crossReview` kapalıysa oturumun aracı (üretiliyorsa), açıksa işi yazan aracın dışındaki ilk hedef |
| Danışılan rol | Çağıranın (danışanın koştuğu) aracı, rol orada üretiliyorsa; değilse rolün ilk hedefi |

### K4 — Atama tablosu (yalnız `taskAssignments` açıkken)

Plan netleşip kapı 1'den **önce** tek tablo: bu işte rol alanlar (işi yapan, iki denetçi,
işi yapanın `consults`'undaki roller) × araç. Her satırda "varsayılan (şu an: <araç>)" ve
seçilebilecek araçlar (rolün etkin hedefleri, CLI'ı kurulu olanlar). Kullanıcı yalnız
değiştirmek istediğini söyler; **sadece o satırlar** `assignments`'a yazılır. Hiçbir şey
söylemezse alan yazılmaz.

Her adımdan önce tek satır bilgi: "Kod denetimi Claude'da yapılacak (varsayılan)." Kullanıcı
o an değiştirirse değer `assignments`'a yazılır ve o adım ona göre koşar. Özellik kapalıyken
bu satır da yoktur.

### K5 — Çağrı yolu

Çözülen araç oturumun aracıysa normal yol; değilse mevcut dış çağrılar:
- denetim: *Başka ekosistemdeki kapı sahibi* (salt okunur);
- işi yapan: *Başka ekosistemdeki executor* (yazma; kullanıcı onayı, temiz ağaç, diske bakarak
  doğrulama — bugünkü kurallar);
- danışma (yeni): salt okunur dış çağrı; prompt = rolün tanımı + soru + ilgili plan bölümü;
  cevap danışana döner. **Dış araçta koşan bir executor danışamaz** (sandbox başka CLI
  çağıramayabilir): danışma gerekiyorsa `blocked: consult <rol>: <soru>` döner; çağıran
  danışmayı K3/`assignments`'a göre yapar ve executor'ı cevapla yeniden çağırır.

### K6 — Dış çağrıda rolün modeli

Hedef aracın üretilmiş ajan dosyasından model ve effort okunur ve çağrıya eklenir:

| Araç | Kaynak | Bayraklar |
|---|---|---|
| Claude | `.claude/agents/<ad>.md` frontmatter `model`, `effort` | `--model`, `--effort` |
| Codex | `.codex/agents/<ad>.toml` `model`, `model_reasoning_effort` | `-m`, `-c model_reasoning_effort=<e>` |
| OpenCode | `.opencode/agents/<ad>.md` `model`, `reasoningEffort` | `-m`, `--variant` |

Değer yoksa bayrak verilmez (CLI varsayılanı). Değerler kabuk argümanı olarak tırnaklanır;
yalnız üretilmiş dosyadan gelir.

### K7 — Kurulu projede `work-plan`'ı yenileme

Upgrade'e "plan kapısı skill'ini güncelle" akışı: `.agent-source/skills/work-plan/SKILL.md`'yi
güncel şablondan `docLanguage`'de yeniden render eder, `taskAssignments` ve `crossReview`
sorularını sorar, sync çalıştırır. `.agent-work/` verisine dokunmaz. Kullanıcı skill'i elle
değiştirdiyse farkı gösterip onay alır.

## Kapsam dışı

- Plan kapısı kapalı projeler (iş başına kayıt yok).
- Aynı iş için birden çok executor.

## Etkilenen dosyalar

`templates/plan.md`, `templates/work-plan-skill.md`, `plan-gate.md`, `manifest-schema.md`,
`validate-manifest.mjs` (+selftest), `validate-plan-gate.mjs` (şablon beklentileri, +selftest),
setup 7C, upgrade (K1 ve K7), `wizard-state.md`, README.
