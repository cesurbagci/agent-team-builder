# Tasarım: Yol sahipliğinin tek kaynağı routing

- **Tarih:** 2026-10-03
- **Durum:** Onaylandı (kullanıcı, seçenek A)
- **Kapsam:** Rol dosyalarını uygulamadan bağımsız yapmak; sahipliği yalnız
  `manifest.routing[]` ve onun `instructions.md` tablosunda tutmak; kaymayı `sync --check`
  ile yakalamak.

## Problem

`agent-md-rich.md` her rol dosyasına somut yol listesi yazdırıyor (Rol & Sınırlar,
Sorumluluk Alanı, Çalışma / Yasak, Kod–Doküman, Routing & Danışma, Kısıtlar). Sync rol
dosyalarını ve `instructions.md`'yi kopyalar, manifest'ten üretmez. Aynı sahiplik üç yerde
yaşar: `manifest.routing`, `instructions.md` routing tablosu, her rol dosyası. `--check`
kaymayı görmez. Gerçek bir kurulumda tek bir sahiplik değişikliği sekiz rol dosyasını elle düzeltmeyi
gerektirdi.

## Kararlar

### K1 — Tek kaynak
- Yol sahipliği: `manifest.routing[]` ve `instructions.md`'deki routing tablosu (sync
  tabloyu manifest'le karşılaştırır, K4).
- Kod–doküman eşleştirmesi: `manifest.codeDocSync[]` ve `instructions.md`'deki
  `c:codeDocSync` bloğunun tablosu (K4).
- Rol dosyaları sahiplik bilgisi taşımaz.

### K2 — Rol dosyası kalıbı
Sahiplikle ilgili metin `<!-- ownership -->` … `<!-- /ownership -->` işaret çiftleri
arasında durur (bir dosyada birden çok çift olabilir). İçerik genel ifadedir:
- Yazma alanı: "Yazma alanın, `instructions.md`'deki routing tablosunda rolüne atanmış
  yollardır. Bir dosya birden çok satıra uyarsa en özgül yol kazanır. Diğer yolları yalnız
  oku; değişiklik gerekiyorsa lider üzerinden sahibine yönlendir."
- Kod yazmayan rol: "Kod yazma" + aynı cümle; yolu olmayan salt-okunur rol: "Hiçbir dosyayı
  değiştirme."
- Kod–doküman: "Eşleştirmeler `instructions.md`'deki kod–doküman bölümündedir." + rolün
  görevi (kod sahibi bildirir, doküman sahibi günceller).
- Danışma: `consults[]`'taki rol adları kalır.
- Rolün kimliğini tanımlayan domain atfı kalabilir ("yalnız bir servis için var olan analist");
  sahiplik tablosunun kopyası, başka rollerin yollarını sayan cümle ve servis adı listesi
  yazılmaz.
- İşaretlerin dışındaki bölümler (Skill'ler, Dil, Denetim Eksenleri, Plan Kapısı, projeye
  özel çıktı şablonu ya da standart bölümleri gibi) serbesttir; kontrol onlara bakmaz.

### K3 — Makine düzeyi aynen kalır
Codex `sandbox_mode`, OpenCode `permission.edit` rol bazındadır; değişmez. Sync'in Codex
`developer_instructions`'a routing'den ürettiği yol satırları da kalır — her sync'te
yeniden üretildiği için kaymaz. Üretilen izin çıktıları değişmez.

### K4 — Kayma kontrolleri (sync)
Her biri `ctx.mismatch` olur: `sync`'te uyarı, `--check`'te hata.

1. **Yol literal'i.** Bir routing satırının kendisi şu yerlerde geçerse:
   - rol dosyasında bir `ownership` işaret çiftinin içinde;
   - manifest'te bir agent'ın `rules[]` ya da `extra_instructions[]` maddesinde.

   "Satırın kendisi": satırın yolu (`services/orders/**`), glob'suz dizin biçimi (`services/orders/`,
   `services/gateway/docs/`, `services/gateway/docs`) ve dosya satırı (`services/gateway/docs/README.md`).
   Yalnız `/` içeren biçimler aranır — tek parçalı adlar (`build.gradle`, `gradlew`) düz
   metinde sıradan sözcük gibi geçebilir. Eşleşme sınırlıdır: önündeki karakter yol
   karakteri olamaz (`./gradlew` yakalanmaz), arkasındaki karakter yolu derinleştiremez
   (`/`, harf, rakam, `.`, `-`, `_`, `*`, `<`, `{`). Böylece daha derin domain yolları
   (`services/gateway/docs/<api>/sources/`) yakalanmaz — onlar rolün işini tarif eden
   kurallardır.
2. **Routing tablosu.** `instructions.md`'de ikinci hücresi tek bir backtick'li agent adı,
   birinci hücresi bir ya da daha çok backtick'li yol olan tablo satırları routing tablosu
   sayılır (`c:codeDocSync` bloğu hariç). Küme manifest'teki `{path, role}` kümesiyle
   birebir aynı olmalı: eksik ve fazla satırlar raporlanır. Hiç satır bulunmazsa (eski
   biçim) mismatch değil uyarı.
3. **Kod–doküman tablosu.** `c:codeDocSync` bloğundaki iki hücresi de tek backtick'li yol
   olan satırlar `manifest.codeDocSync[]`'in `{code, doc}` kümesiyle aynı olmalı. Blok
   yoksa kontrol yok.

Kontrol mantığı ayrı bir modülde (`ownership-drift.mjs`, saf fonksiyonlar + selftest);
sync yalnız çağırır.

Bulgular yalnız proje yeni yapıya geçtiyse (en az bir rol dosyası `ownership` işareti
taşıyorsa) mismatch'tir; öncesinde uyarıdır ve team-builder-upgrade göçünü önerir — bir
team-builder güncellemesi göç etmemiş projelerde `--check`'i düşürmez.
`ownership-drift.mjs --scan <proje>` işaretlerin **dışında** kalan routing satırlarını
listeler; göç bunları kullanıcıya gösterir, karar onundur (iş kuralı olabilir).

### K5 — Kurulum
Setup rol dosyalarını K2 kalıbıyla üretir. `governance-defaults.md`'deki yol içeren
kurallar ("Sadece kendi domain'inde (`<paths>`) kod yaz", "`<o yol>` altına yazma") genel
ifadeye çevrilir; manifest `rules[]`'a yol yazılmaz.

### K6 — team-builder-module
Sahiplik değişince rol dosyalarına dokunulmaz. Güncellenenler: manifest, `instructions.md`
routing bölümü, gerekirse `c:codeDocSync` bloğu ve takım dosyaları. İstisnalar: yeni rol
açılırsa onun dosyası K2 kalıbıyla yazılır; mevcut roller yeni role danışacaksa danışma
satırına rol adı eklenir.

### K7 — team-builder-upgrade göçü
"Rol dosyalarını sahiplikten arındır" akışı:
1. Her rol dosyası için sahiplik bölümlerini K2 metniyle değiştir ve işaretle; elle
   eklenmiş bölümleri aynen koru.
2. Manifest `rules[]`/`extra_instructions[]`'tan yalnız K4.1'e takılan maddeleri genel
   ifadeye çevir ya da çıkar; daha derin domain yolu içeren kuralları koru.
3. Rol başına farkı göster, onay al; onaysız yazma.
4. `validate-manifest` ve sync + `--check` temiz geçmeli.

### K8 — Belgeler
README (EN/TR), `routing.md`, `canonical-source.md`, `sync-pipeline.md`,
`agent-md-rich.md`, `member-template.md` (varsa yol kalıbı).

## Kabul ölçütleri
- Yeni kurulumun rol dosyalarında routing satırı geçmez; ajanlar sahipliği
  `instructions.md` tablosundan çözer.
- team-builder-module ile sahip değişince yalnız manifest ve `instructions.md` (gerekirse
  codeDocSync bloğu, takım dosyaları) değişir.
- Upgrade örnek projenin kopyasında eski rol dosyalarını genelleştirir, elle eklenmiş
  bölümleri korur; ardından `validate-manifest` ve `sync --check` temiz.
- Selftest'ler geçer; Codex/OpenCode izin çıktıları değişmez.

## Kapsam dışı (ayrı onayla)
- (a) Servise özel mimari belgeler (`<servis>/docs/architecture/**` → architect).
- (b) Kod–doküman kuralının gevşek biçimi ("belge etkisi yok" beyanı).
