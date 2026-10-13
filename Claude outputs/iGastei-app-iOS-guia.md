# 📱 iGastei — App iOS com Capacitor (guia passo a passo)

Este guia transforma o iGastei (site React) em um app de iPhone usando **Capacitor**.
Tudo que já dava pra adiantar, o Claude já deixou pronto no seu projeto:

- ✅ `capacitor.config.ts` (nome "iGastei", ID `br.com.meuigastei.app`, fundo navy)
- ✅ Ícone e splash da marca em `assets/` (`icon.png`, `splash.png`, `splash-dark.png`)
- ✅ `.gitignore` já ignora os arquivos pesados do build iOS

Você só executa os comandos abaixo **no Terminal do Mac** (o mesmo do firebase/git).

---

## 🟢 PARTE 0 — Comece HOJE (são coisas que demoram sozinhas)

### 0.1 Criar a conta Apple Developer (leva 1–2 dias pra aprovar)
1. Acesse **https://developer.apple.com/programs/enroll/**
2. Entre com seu Apple ID (o mesmo do seu iPhone serve).
3. Escolha o tipo de conta:
   - **Individual** → mais rápido, aparece com seu nome pessoal.
   - **Organização (empresa)** → aparece com o nome da empresa, mas exige um número D-U-N-S (demora mais).
   - 👉 Sugestão pra lançar rápido: **Individual** agora, migra pra empresa depois se quiser.
4. Pague a anuidade (**US$ 99/ano**).
5. Espere o e-mail de aprovação (normalmente 24–48h).

> ⚠️ Sem essa conta você AINDA consegue testar o app no seu próprio iPhone e no simulador.
> Ela só é obrigatória pra **publicar** na App Store. Por isso: comece agora, siga o resto em paralelo.

### 0.2 Instalar o Xcode (download grande, ~7 GB)
1. Abra a **App Store** no Mac → busque **Xcode** → **Obter/Instalar**.
2. Depois de instalar, abra o Xcode uma vez e aceite os termos.
3. No Terminal, rode (uma vez só):
   ```
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```

### 0.3 Instalar o CocoaPods (gerenciador de libs do iOS)
No Terminal:
```
sudo gem install cocoapods
```
Se der erro de permissão, tente:
```
brew install cocoapods
```
(se não tiver o `brew`, instale em https://brew.sh e repita)

Confirme que ficou tudo ok:
```
xcodebuild -version
pod --version
```
Os dois têm que responder com um número de versão.

---

## 🔵 PARTE 1 — Montar o app (no Terminal, na pasta do projeto)

```
cd ~/Downloads/financeirU
```

**1.1 Instalar o Capacitor:**
```
npm install @capacitor/core @capacitor/cli @capacitor/ios
```

**1.2 Instalar o gerador de ícones:**
```
npm install -D @capacitor/assets
```

**1.3 Gerar a versão web (cria a pasta `dist`):**
```
npm run build
```

**1.4 Criar o projeto nativo do iOS:**
```
npx cap add ios
```
(esse passo baixa os "pods" — pode demorar alguns minutos na 1ª vez)

**1.5 Gerar os ícones e a tela de abertura a partir do `assets/`:**
```
npx capacitor-assets generate --ios
```

**1.6 Sincronizar tudo:**
```
npx cap sync ios
```

**1.7 Abrir no Xcode:**
```
npx cap open ios
```

---

## 🟣 PARTE 2 — Testar no simulador (dentro do Xcode)

1. No topo do Xcode, ao lado do nome "App", escolha um iPhone no menu (ex: **iPhone 16**).
2. Clique no botão ▶️ (Run).
3. O simulador abre e carrega o iGastei. 🎉

> Se aparecer erro de "Signing", vá em **Signing & Capabilities** → marque **Automatically manage signing** →
> em **Team**, escolha sua conta (depois que a Apple aprovar). Pra rodar só no simulador, muitas vezes
> nem precisa de team.

---

## 🟠 PARTE 3 — Pontos que vamos resolver juntos (me chama quando chegar aqui)

### 3.1 ⚠️ Pagamento no iOS (importante!)
A Apple **não deixa** cobrar a assinatura (R$9,90/mês) por dentro do app iOS usando Stripe.
Regra 3.1.1 → tem que ser o **In-App Purchase da Apple** (comissão de 15–30%).

Dois caminhos (a gente decide junto):
- **A)** Integrar o IAP da Apple só no iOS (mais trabalho, mas vende dentro do app).
- **B)** App iOS não vende nada — a pessoa assina no site meuigastei.com.br e no app só faz login/usa
  (mais simples e sem comissão, mas o upgrade acontece fora do app).

### 3.2 Login e Firebase
O login por e-mail/senha (Firebase) funciona normal dentro do app. Vamos só confirmar depois do 1º build.

### 3.3 Publicar na App Store
Quando a conta Apple estiver aprovada e o app testado, a gente:
1. Cria o app no **App Store Connect**.
2. Preenche descrição, screenshots, categoria (Finanças).
3. Faz o **Archive** no Xcode e envia.
4. Aguarda a revisão da Apple (normalmente 1–3 dias).

---

## ✅ Resumo do que fazer agora
1. Começar a conta Apple Developer (0.1) — **hoje**, porque demora.
2. Instalar Xcode (0.2) e CocoaPods (0.3).
3. Rodar a PARTE 1 e me avisar em qual passo você está / se der erro.

Qualquer erro que aparecer, copia e cola aqui que eu resolvo na hora.
