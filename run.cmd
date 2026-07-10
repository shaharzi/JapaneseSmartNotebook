@echo off
setlocal

echo.
echo Japanese Smart Notebook
echo The API key will not be saved to a file.
echo.

set /p OPENAI_API_KEY=Paste OpenAI API key:

if "%OPENAI_MODEL%"=="" set OPENAI_MODEL=gpt-5-mini

dotnet run

set OPENAI_API_KEY=
endlocal
