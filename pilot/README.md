# Pilot: kapak -> hareket klibi (Kaggle ücretsiz GPU)

1. Kaggle: Settings → API → **Create New Token** → inen `kaggle.json` dosyasını `C:\Users\<kullanici>\.kaggle\kaggle.json` yoluna koy.
   (Hesapta telefon doğrulaması açık olmalı; notebook'ta GPU ve internet için gerekli.)
2. `node --env-file=.env pilot/kaggleRun.mjs`.
3. Çıktılar `pilot/out/` içine iner (`*.mp4`, `results.json`).

`pilot/.build` ve `pilot/out` git'e girmez.
