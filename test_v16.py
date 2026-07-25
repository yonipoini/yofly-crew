from PIL import Image

img = Image.open('assets/app-icon-square-v16.png')
pixels = img.load()

# Let's see if there are any bright pixels in v16
found = False
for y in range(1024):
    for x in range(1024):
        r, g, b, a = pixels[x, y]
        dist_sq = (x - 512)**2 + (y - 512)**2
        if dist_sq > 400**2:
            if r > 50 or g > 50 or b > 50:
                print(f"Found bright pixel at {x}, {y}: {r},{g},{b}")
                found = True
                break
    if found:
        break
