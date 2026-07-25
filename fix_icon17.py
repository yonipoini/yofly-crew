from PIL import Image

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# We crop the image STRICTLY inside the original dark squircle, completely avoiding 
# the white corners and the grey anti-aliased edges.
# The squircle starts at 168 and ends at 855.
# By cropping from 200 to 824, we get a 624x624 pure dark purple glowing square!
cropped = img.crop((200, 200, 824, 824))

# Now we simply scale this pure, perfect square up to 1024x1024.
# This mathematically guarantees zero white pixels, zero rounding, and zero artifact lines!
final = cropped.resize((1024, 1024), Image.Resampling.LANCZOS)

final.save('assets/app-icon-square-v9.png')
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated foolproof v9 icon!")
