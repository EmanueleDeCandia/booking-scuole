Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\user\.gemini\antigravity-ide\brain\8f5ce416-7497-4efe-a2be-f9f72aa7c75f\naive_app_icon_1789080864964.jpg"
$pubDir = "c:\Users\user\Desktop\AI-AR\Booking-app\3d-agenda-booking-application-fable-5.1\public"
$appDir = "c:\Users\user\Desktop\AI-AR\Booking-app\3d-agenda-booking-application-fable-5.1\src\app"

function Make-ResizedImage($source, $target, $w, $h) {
    $srcImg = [System.Drawing.Image]::FromFile($source)
    $destBmp = New-Object System.Drawing.Bitmap($w, $h)
    $graphics = [System.Drawing.Graphics]::FromImage($destBmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($srcImg, 0, 0, $w, $h)
    $destBmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $destBmp.Dispose()
    $srcImg.Dispose()
    Write-Host "Creato: $target"
}

Make-ResizedImage $srcPath (Join-Path $pubDir "icon-512x512.png") 512 512
Make-ResizedImage $srcPath (Join-Path $pubDir "icon-192x192.png") 192 192
Make-ResizedImage $srcPath (Join-Path $pubDir "apple-touch-icon.png") 180 180
Make-ResizedImage $srcPath (Join-Path $pubDir "favicon-32x32.png") 32 32
Make-ResizedImage $srcPath (Join-Path $pubDir "favicon.ico") 48 48
Make-ResizedImage $srcPath (Join-Path $appDir "favicon.ico") 48 48

Write-Host "Completato con successo!"
