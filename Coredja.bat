@echo off
chcp 65001 >nul
title Coredja - servidor
cd /d "%~dp0"

echo.
echo   ============================================
echo      COREDJA - Comunicacao interna da igreja
echo   ============================================
echo.

REM ---------------------------------------------------------------------
REM Primeira execucao: instala as dependencias se ainda nao existirem.
REM ---------------------------------------------------------------------
if not exist "node_modules" (
    echo   Primeira vez rodando. Preparando o programa...
    echo   Isso demora alguns minutos. So acontece uma vez.
    echo.
    call pnpm install
    if errorlevel 1 goto erro_preparar
    echo.
)

REM ---------------------------------------------------------------------
REM Monta a versao de uso. Refaz sozinho quando o codigo muda.
REM ---------------------------------------------------------------------
if not exist ".next\BUILD_ID" (
    echo   Montando o programa. Aguarde...
    echo.
    call pnpm build
    if errorlevel 1 goto erro_montar
    echo.
)

REM ---------------------------------------------------------------------
REM Descobre o endereco deste PC na rede local, para os celulares.
REM
REM Nao basta pegar o primeiro IPv4 que aparece: uma VPN (Tailscale) ou um
REM adaptador desconectado costuma responder antes, com um endereco que os
REM celulares nao alcancam. Enderecos 169.254.x.x sao o que o Windows inventa
REM quando NAO conseguiu entrar na rede, e por isso sao descartados aqui.
REM
REM A busca segue a ordem das faixas usadas por roteadores domesticos.
REM ---------------------------------------------------------------------
set "IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do (
        if not defined IP (
            echo %%b | findstr /r "^192\.168\." >nul && set "IP=%%b"
        )
    )
)
if not defined IP (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
        for /f "tokens=* delims= " %%b in ("%%a") do (
            if not defined IP (
                echo %%b | findstr /r "^10\." >nul && set "IP=%%b"
            )
        )
    )
)
if not defined IP (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
        for /f "tokens=* delims= " %%b in ("%%a") do (
            if not defined IP (
                echo %%b | findstr /r "^172\.1[6-9]\. ^172\.2[0-9]\. ^172\.3[0-1]\." >nul && set "IP=%%b"
            )
        )
    )
)

echo   ============================================
echo      PRONTO - o Coredja esta no ar
echo   ============================================
echo.
echo   NESTE PC (painel do audiovisual):
echo      http://localhost:3000/painel
echo.
if defined IP (
    echo   NOS CELULARES das areas ^(mesmo Wi-Fi^):
    echo      Cantina:  http://%IP%:3000/a/cantina-x7k2m9
    echo      Kids:     http://%IP%:3000/a/kids-p4w8n3
    echo.
) else (
    echo   [ATENCAO] Este PC nao esta conectado a uma rede local.
    echo   O painel funciona aqui, mas os celulares nao vao alcancar.
    echo   Conecte o PC no Wi-Fi da igreja e abra este atalho de novo.
    echo.
)
echo   --------------------------------------------
echo   NAO FECHE ESTA JANELA enquanto estiver usando.
echo   Para desligar: feche a janela ou aperte Ctrl+C.
echo   --------------------------------------------
echo.

REM Abre o painel no navegador depois de dar tempo do servidor subir.
start "" /b cmd /c "timeout /t 4 >nul & start http://localhost:3000/painel"

call pnpm start
goto fim

:erro_preparar
echo.
echo   [ERRO] Nao foi possivel preparar o programa.
echo   Verifique se o pnpm esta instalado (comando: pnpm --version).
echo.
pause
exit /b 1

:erro_montar
echo.
echo   [ERRO] Nao foi possivel montar o programa.
echo   Envie o texto acima para quem cuida do sistema.
echo.
pause
exit /b 1

:fim
echo.
echo   Servidor encerrado.
pause
