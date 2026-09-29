# wizard-state.md — Sihirbaz Durum Kaydı (resume)

> Paylaşılan referans. `team-builder-setup` her adımda ilerlemeyi diske yazar; başka bir
> oturumda kullanıcı kaldığı yerden devam edebilir.

## Konum
`.claude/team-builder-state.json` (proje kökünde). **`.agent-source/` İÇİNDE DEĞİL** — takımın
kurulu olduğunun sinyali `.agent-source/agents/manifest.json`'dır ve Adım 8'de yazılır; ondan
önce `.agent-source/`'ta yalnız `team-builder-models` Akış 1'in yazdığı `llm.json` olabilir.
State dosyası bağımsızdır.

## Ne zaman yazılır
**Her adım/alt-adım tamamlanınca** (kullanıcı bir soruya cevap verip o parça kesinleşince)
state dosyasını güncelle. Özellikle:
- Her wizard adımı (hedef, topoloji, docLanguage, arch-root, kalite odakları, anayasa, routing) sonrası.
- **Her agent tek tek yapılandırıldıktan sonra** (her rol bitince `agents[]`'a ekle + yaz).
Böylece oturum yarıda kesilse bile en fazla bir küçük adım kaybolur.

## Ne zaman silinir
**Üretim (Adım 8) başarıyla bittiğinde** (`.agent-source/` yazıldı + sync drift temiz) state
dosyasını **sil**. Kurulum tamamlandı; artık `team-builder-models`, `team-builder-upgrade` ve `team-builder-sync` kullanılır; rol değişiklikleri elle yapılır (manifest, rol dosyası ve `llm.json` girdileri, sonra sync).

## Şema
```jsonc
{
  "version": 1,
  "status": "in-progress",              // bitince zaten silinir
  "updatedAt": "YYYY-MM-DDTHH:MM:SS",   // opsiyonel (interaktif oturumda tarih erişilebilir)
  "currentStep": 5,                      // 1..10 (en son tamamlanan/üzerinde olunan adım)
  "currentAgentIndex": 2,                // Adım 5'te kaçıncı rolü yapılandırıyoruz (0-bazlı)
  "answers": {
    "targetsDefault": ["claude","codex"],
    "topology": "subagent",
    "docLanguage": "tr",
    "architectureDocs": { "root": "docs/mimari", "layout": "central" },
    "selectedRoles": ["architect","ios-developer","web-developer","reviewer"], // checkbox seçimi
    "agents": [ /* tamamlanmış agent girişleri (manifest agents[] formatında) */ ],
    "pendingRoles": ["reviewer"],        // seçili ama henüz yapılandırılmamış
    "focus": ["performance","code-design"],
    "constitution": { "noWorkaround": true, "codeDocSync": true, "perAgentMemory": true, "languageStandard": true, "planGate": true },
    "planGate": { "planReviewer": "architect", "codeReviewer": null },  // yalnız constitution.planGate açıksa
    "vendorTeamBuilder": true,  // 8a: team-builder projeye de kopyalansın mı
    "codeDocSync": [],
    "routing": [],
    "lead": "architect"
  }
}
```
Alanlar `manifest-schema.md` ile uyumlu; tamamlanan kısımlar doldurulur, gerisi boş kalır.

## Resume akışı (Adım 1'de)
1. `.agent-source/agents/manifest.json` **varsa** → takım zaten kurulu; var olan skill'lere yönlendir (`team-builder-models`, `team-builder-upgrade`, `team-builder-sync`), state'e bakma.
2. Yoksa `.claude/team-builder-state.json` **varsa** → kullanıcıya sade sor:
   > "Bu projede yarım kalmış bir takım kurulumu var (en son: **<currentStep adının sade adı>**, **<n>** rol yapılandırıldı). Devam edelim mi, yoksa baştan mı başlayalım?"
   - **Devam** → state'i yükle, `currentStep`/`currentAgentIndex`'ten sonraki adımdan devam et. Tamamlanmış cevapları tekrar sorma; kısa bir "şu ana kadar seçtiklerin" özeti göster.
   - **Baştan** → state dosyasını sil, sıfırdan başla.
3. İkisi de yoksa → yeni kurulum.

## Notlar
- State **tek gerçek ilerleme kaydıdır**; her adımda güncel tutulur (yazmayı unutma).
- Bozuk/eksik state → kullanıcıya söyle, baştan başlamayı öner.
- Diğer skill'ler bu state'i kullanmaz; kurulumu tamamlanmış bir proje üzerinde çalışırlar.
- **İki kapı sahibi sorusu ayrı ayrı kaydedilir.** Kullanıcı plan kapısını açıp ilk soruyu
  cevapladıktan sonra oturum kesilirse, resume'da o cevap **yeniden sorulmaz**: state'te
  `answers.planGate.planReviewer` doludur, `codeReviewer` anahtarı henüz yoktur. Devam
  ederken yalnız eksik anahtarı sor. `constitution.planGate` kapalıysa `answers.planGate`
  hiç yazılmaz.
