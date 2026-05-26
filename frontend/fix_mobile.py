import sys

with open('src/components/MobileScreen.jsx', 'r') as f:
    lines = f.readlines()

with open('src/missing.txt', 'r') as f:
    missing = f.read()

# Find where to start replacing
start_idx = -1
for i, line in enumerate(lines):
    if ") :" in line and "gameState.status === 'FINISHED' ?" in line:
        start_idx = i
        break
        
if start_idx == -1:
    # It might just be `)` on a line, look for `          )`
    for i, line in enumerate(lines):
        if "          )" in line and "Opciones de esta votación" in lines[i+2]:
            start_idx = i
            break

print("Start idx:", start_idx)
# Everything up to start_idx is kept
new_content = "".join(lines[:start_idx]) + missing + "\n"

# The end of the file is just:
new_content += """              {/* Host Return to Lobby Button */}
              {gameState.host === role && (
                <button 
                  onClick={() => {
                    if (confirmLobby) socket.emit('returnToLobby');
                    else {
                      setConfirmLobby(true);
                      setTimeout(() => setConfirmLobby(false), 3000);
                    }
                  }}
                  className={`w-full font-bold text-xl py-4 rounded-xl mt-4 transition-colors ${confirmLobby ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}
                >
                  {confirmLobby ? '¿Estás Seguro? (Toca de nuevo)' : 'Volver al Lobby (Host)'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
};

export default MobileScreen;
"""

with open('src/components/MobileScreen.jsx', 'w') as f:
    f.write(new_content)

print("Done")
