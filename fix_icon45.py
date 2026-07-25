from PIL import Image

# The user uploaded a custom image. Let's process it and save it as the final icons.
img_path = '/Users/yoni/.gemini/antigravity-ide/brain/4de2acdb-2f5c-4f3e-883b-2f1b09a17791/media__1782790132835.jpg'
img = Image.open(img_path).convert('RGBA')

# Resize to exactly 1024x1024 if it isn't already
if img.size != (1024, 1024):
    img = img.resize((1024, 1024), Image.Resampling.LANCZOS)

# Save to the asset locations
img.save('assets/app-icon-square-v29.png')
img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully processed user's uploaded image and saved it as the final icons!")
