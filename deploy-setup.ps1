# ============================================================
# Planeamento DENSIDADES — Setup Git + GitHub para Railway
# ============================================================
# Corre este script UMA SÓ VEZ na pasta Railway/ para preparar
# o repositório Git local. Depois segue os passos no README.

$ErrorActionPreference = 'Stop'

Write-Host "`n=== Setup Git para deploy Railway ===" -ForegroundColor Green
Write-Host "Pasta: $PWD`n"

# --- 1) Verificar Git instalado ---
try {
    $gitVer = git --version
    Write-Host "[OK] $gitVer"
} catch {
    Write-Host "[ERRO] Git nao esta instalado. Descarrega de https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}

# --- 2) Limpar node_modules e package-lock se existirem ---
if (Test-Path 'node_modules') {
    Write-Host "[INFO] A apagar node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
}
if (Test-Path 'package-lock.json') {
    Write-Host "[INFO] A apagar package-lock.json..." -ForegroundColor Yellow
    Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
}

# --- 3) Inicializar repo Git (se ainda nao existe) ---
if (-not (Test-Path '.git')) {
    Write-Host "[INFO] A inicializar repositorio Git..." -ForegroundColor Yellow
    git init -b main | Out-Null
    Write-Host "[OK] Repositorio Git criado (branch main)"
} else {
    Write-Host "[OK] Repositorio Git ja existia"
}

# --- 4) Configurar utilizador (apenas para este repo) ---
$existingName = git config user.name 2>$null
if (-not $existingName) {
    git config user.name 'Rui Pedro Silva'
    git config user.email 'rpsilva@corksupply.pt'
    Write-Host "[OK] Configurado user.name e user.email"
}

# --- 5) Adicionar ficheiros + commit ---
Write-Host "[INFO] A adicionar ficheiros..." -ForegroundColor Yellow
git add .
$staged = git diff --cached --name-only
if (-not $staged) {
    Write-Host "[INFO] Nada para commitar (ja esta tudo commitado)"
} else {
    Write-Host "Ficheiros a commitar:"
    $staged | ForEach-Object { Write-Host "  - $_" }
    git commit -m "Initial commit: Planeamento Densidades para Railway" | Out-Null
    Write-Host "[OK] Commit criado" -ForegroundColor Green
}

# --- 6) Mostrar proximos passos ---
Write-Host "`n=== PROXIMOS PASSOS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1) Cria um repositorio NOVO no GitHub (privado):" -ForegroundColor White
Write-Host "   https://github.com/new" -ForegroundColor Yellow
Write-Host "   Nome sugerido: planeamento-densidades"
Write-Host "   NAO inicializes com README, .gitignore nem licenca (ja existem aqui)."
Write-Host ""
Write-Host "2) Apos criar, o GitHub mostra o URL. Volta aqui e corre:" -ForegroundColor White
Write-Host "   git remote add origin https://github.com/<TEU_UTILIZADOR>/planeamento-densidades.git" -ForegroundColor Yellow
Write-Host "   git push -u origin main" -ForegroundColor Yellow
Write-Host ""
Write-Host "3) Vai a https://railway.app/new" -ForegroundColor White
Write-Host "   - New Project -> Deploy from GitHub repo"
Write-Host "   - Autoriza acesso ao teu GitHub se for a 1a vez"
Write-Host "   - Seleciona 'planeamento-densidades'"
Write-Host "   - Railway detecta package.json + nixpacks.toml e arranca o build"
Write-Host ""
Write-Host "4) Quando o build acaba, vai a Settings -> Networking -> Generate Domain" -ForegroundColor White
Write-Host "   -> tens o URL publico (algo como planeamento-densidades.up.railway.app)"
Write-Host ""
Write-Host "5) Auto-deploy: a partir daqui, sempre que alteras Planeamento_Densidades.html," -ForegroundColor White
Write-Host "   corre estes 4 comandos e o Railway atualiza automaticamente:" -ForegroundColor White
Write-Host ""
Write-Host "   copy ..\Planeamento_Densidades.html public\index.html" -ForegroundColor Yellow
Write-Host "   git add ." -ForegroundColor Yellow
Write-Host "   git commit -m ""Atualizacao do prototipo""" -ForegroundColor Yellow
Write-Host "   git push" -ForegroundColor Yellow
Write-Host ""
Write-Host "=== Setup local pronto ===" -ForegroundColor Green
