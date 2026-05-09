const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const target1 = `            try {
                const stream = await play.stream(track.url);
                const resource = createAudioResource(stream.stream, { inputType: stream.type });
                queue.player.play(resource);
                const panel = generateMusicPanel(queue); const msg = await interaction.editReply(panel); queue.panelMessage = msg; return;
            } catch (err) {
                console.error('Playback Error:', err);
                queue.current = null;
                return interaction.editReply({ content: '❌ Failed to play track.' });
            }`;

const replacement1 = `            try {
                const cid = await play.getFreeClientID();
                await play.setToken({ soundcloud : { client_id : cid } });
                const stream = await play.stream(track.url);
                const resource = createAudioResource(stream.stream, { inputType: stream.type });
                queue.player.play(resource);
                const panel = generateMusicPanel(queue); const msg = await interaction.editReply(panel); queue.panelMessage = msg; return;
            } catch (err) {
                console.error('Playback Error:', err.message);
                queue.current = null;
                return interaction.editReply({ content: '❌ Failed to play track.' });
            }`;

if (code.includes(target1)) {
    code = code.replace(target1, replacement1);
    fs.writeFileSync('index.js', code);
    console.log('Fixed stream error in /play block');
} else {
    console.log('Target 1 not found');
}
