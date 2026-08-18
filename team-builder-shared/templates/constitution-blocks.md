# constitution-blocks.md — Anayasa Blok Şablonları

> Paylaşılan referans. `team-builder-setup` kurulumda, `team-builder-upgrade` preset
> açarken **aynı** bloğu buradan render eder. Metnin tek kaynağı burasıdır.
>
> **Verbatim kopyalanmaz.** Bloklar `docLanguage`'e çevrilir ve `<...>` yer tutucuları
> projenin cevaplarıyla doldurulur. `templates/plan.md` ve `templates/work-plan-skill.md`
> ile aynı disiplin.
>
> **İşaretler çevrilmez.** Başlıklar `docLanguage`'e çevrilir, bu yüzden hiçbir kural
> başlığa bakamaz — blok sınırları sabit HTML yorumlarıyla bulunur.

Her blok `.agent-source/project/instructions.md` içine, açık olan preset için konur.
Kapalı preset'in bloğu **bulunmaz**; blok varlığı preset'in açık olduğu anlamına gelir.

## `c:noWorkaround`

```markdown
<!-- c:noWorkaround -->
## Geçici çözüm yok

"Çalışıyor olması yetmez." Mimari kararı bypass eden hack kabul edilmez. Belirsizlikte
<architect varsa: architect'e danışılır / architect yoksa: kullanıcıya sorulur>.

Reddedilen desenler:
<workaround desen listesi — her satır bir madde>
<!-- /c:noWorkaround -->
```

**Yer tutucular:** `architect` dalı manifest'te `architect` rolü var mı diye bakılarak
seçilir. Desen listesi kullanıcıya sorulur (`constitution.md` KARAR 1).

## `c:codeDocSync`

```markdown
<!-- c:codeDocSync -->
## Kod–doküman senkronizasyonu

Şu kod yolları değiştiğinde ilgili doküman da güncellenir:

| Kod | Doküman |
|---|---|
<manifest.codeDocSync[] satırları — kod | doc>

Liste boşsa bu kural yalnız bir disiplindir; otomatik denetimi yoktur.
<!-- /c:codeDocSync -->
```

**Yer tutucular:** tablo `manifest.codeDocSync[]`'ten üretilir. Boş dizi geçerlidir —
o hâlde tablo yazılmaz, yalnız son cümle kalır.

## `c:perAgentMemory`

```markdown
<!-- c:perAgentMemory -->
## Rol başına hafıza

Her agent kendi öğrendiklerini kendi hafıza dosyasında tutar; başka rolün hafızasına
yazmaz. Hafıza, rol talimatının parçasıdır ve rol değişince taşınmaz.
<!-- /c:perAgentMemory -->
```

**Yer tutucu yok.** Generator bu preset'i manifest'ten ayrıca okuyup agent dosyalarına
da yansıtır; buradaki blok projenin insan-okur açıklamasıdır.

## `c:languageStandard`

```markdown
<!-- c:languageStandard -->
## Dil ve yorum standardı

Kod, yorum ve commit mesajları için proje standardı: <docLanguage>. Bir dosyanın
mevcut dili standarttan farklıysa o dosyada **mevcut dile uyulur** — tek dosya içinde
dil karıştırılmaz.
<!-- /c:languageStandard -->
```

**Yer tutucular:** `<docLanguage>` manifest'ten.

## `c:planGate`

```markdown
<!-- c:planGate -->
## Plan kapısı

Kod yazılmadan önce plan yazılır, denetlenir ve **kullanıcı onaylar**. Kullanıcı onayı
atlanamaz. Prosedürün tamamı `work-plan` skill'indedir.

- Plan denetleyicisi: <planReviewer ya da "yok">
- Kod denetleyicisi: <codeReviewer ya da "yok">

Planlar `.agent-work/` altında yaşar; durum, dosyanın bulunduğu klasördür.
<!-- /c:planGate -->
```

**Yer tutucular:** denetleyici adları `manifest.planGate`'ten. `null` ise "yok" yazılır
ve o kapı atlanır.
