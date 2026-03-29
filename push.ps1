param (
    [string]$CommitMessage = "Update changes"
)

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "No changes to commit." -ForegroundColor Yellow
    exit
}

Write-Host "Adding changes (git add .)..." -ForegroundColor Cyan
git add .

Write-Host "Committing changes (git commit -m '$CommitMessage')..." -ForegroundColor Cyan
git commit -m $CommitMessage

Write-Host "Pushing to remote repository (git push)..." -ForegroundColor Cyan
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully pushed to Git!" -ForegroundColor Green
} else {
    Write-Host "Push failed, please check the error message." -ForegroundColor Red
}
