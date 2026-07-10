$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Japanese Smart Notebook v5" -ForegroundColor Magenta
Write-Host "The API key will not be saved to a file." -ForegroundColor DarkGray
Write-Host ""

$secureKey = Read-Host "Paste OpenAI API key" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)

try {
    $env:OPENAI_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)

    if ([string]::IsNullOrWhiteSpace($env:OPENAI_MODEL)) {
        $env:OPENAI_MODEL = "gpt-5-mini"
    }

    dotnet run
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Remove-Item Env:OPENAI_API_KEY -ErrorAction SilentlyContinue
}
