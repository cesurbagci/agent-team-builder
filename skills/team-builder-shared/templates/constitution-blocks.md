# constitution-blocks.md — Anayasa Blok Şablonları

> Paylaşılan referans. `team-builder-setup` kurulumda, `team-builder-upgrade` preset
> açarken **aynı** bloğu buradan render eder. Metnin tek kaynağı burasıdır.
>
> **Verbatim kopyalanmaz.** Bloklar `docLanguage`'e çevrilir; `templates/plan.md` ve
> `templates/work-plan-skill.md` ile aynı disiplin.
>
> **`<...>` yer tutucuları** render anında projenin cevaplarıyla doldurulur. Bu,
> `templates/plan.md`'nin yaptığının aynısıdır; `work-plan-skill.md` yer tutucu taşımaz.
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
<workaround desen listesi — her madde `- ` ile başlayan kendi satırında>
<!-- /c:noWorkaround -->
```

**Yer tutucular:** `architect` dalı, manifest'in `agents[]` dizisinde **adı
`architect` olan** bir agent var mı diye bakılarak seçilir (`agents[].name` — şemada
`role` diye bir alan yoktur). Desen listesi kullanıcıya sorulur (`constitution.md` KARAR 1).

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

- Doküman, yorum metni ve kullanıcıya cevap: **<docLanguage>**.
- Kod artefaktları — fonksiyon, değişken, dosya adı, commit mesajı, JSDoc/TSDoc
  tag'leri: **İngilizce**.
- Yorumun metni <docLanguage>, tag'leri İngilizce. **Karışık dil kabul edilmez.**
<!-- /c:languageStandard -->
```

**Yer tutucular:** `<docLanguage>` manifest'ten. Generator bu preset'i manifest'ten
ayrıca okuyup her agent dosyasına da yansıtır (`agent-md-rich.md` → `## Dil Kuralları`);
buradaki blok projenin insan-okur açıklamasıdır. **İkisi aynı şeyi söylemeli** — kod
İngilizce, doküman/yorum `docLanguage`.

## `c:planGate`

```markdown
<!-- c:planGate -->
## Plan kapısı

Kod yazılmadan önce plan yazılır, **(denetleyici tanımlıysa)** denetlenir ve **kullanıcı
onaylar**. Kullanıcı onayı atlanamaz. Prosedürün tamamı `work-plan` skill'indedir.

- Plan denetleyicisi: <planReviewer ya da "yok">
- Kod denetleyicisi: <codeReviewer ya da "yok">

Planlar `.agent-work/` altında yaşar; durum, dosyanın bulunduğu klasördür.
<!-- /c:planGate -->
```

**Yer tutucular:** denetleyici adları `manifest.planGate`'ten. `null` ise "yok" yazılır
ve o kapı atlanır.
