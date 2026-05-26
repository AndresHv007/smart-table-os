with open('src/components/MobileScreen.jsx', 'r') as f:
    content = f.read()

content = content.replace(
    "          </div>\n        ) : gameState.status === 'FINISHED' ? (",
    "          </div>\n          )\n        ) : gameState.status === 'FINISHED' ? ("
)

with open('src/components/MobileScreen.jsx', 'w') as f:
    f.write(content)

print("Done")
