# Karty pro nás

Rodinné karty s otázkami do mobilu i počítače. Z vějíře si ťukneš na kartu, ta se otočí, přečteš otázku a každý odpoví po svém.

**Hrát:** https://garon92.github.io/KartyProNas/

- 700 otázek v 7 kategoriích, karty se neopakují, dokud neprojdete celý balíček
- jména hráčů – appka ukazuje, kdo vybírá kartu a kdo začíná odpovídat, a dá se odškrtat, kdo už odpověděl
- vlastní otázky a vypínání kategorií v nastavení (ukládá se jen v daném telefonu)
- funguje i bez internetu – po prvním otevření si stránku přidej na plochu

## Jak přidat otázky do balíčku

Otázky jsou v [`cards.js`](cards.js). Stačí připsat řádek do správné kategorie. Po změně zvyš v [`sw.js`](sw.js) číslo verze (`kpn-v1` → `kpn-v2`), aby si telefony stáhly novou verzi.
