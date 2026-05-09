const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const targetBlock = `               // Bridge YouTube's highly accurate search to SoundCloud
               const ytRes = await yts(ytQuery);
               const ytVid = ytRes?.videos ? ytRes.videos[0] : ytRes;

               let scSearchQuery = query;
               if (ytVid && ytVid.title) {
                   // Clean up (Official Video), etc., and append artist name to force exact SC match
                   const cleanTitle = ytVid.title.replace(/[\\(\\[].*?[\\)\\]]/g, '').trim();
                   const cleanAuthor = ytVid.author?.name ? ytVid.author.name.replace(/VEVO|Topic/gi, '').trim() : '';
                   scSearchQuery = \`\${cleanTitle} \${cleanAuthor}\`.trim();
               }

               const r = await play.search(scSearchQuery, { source: { soundcloud: 'tracks' }, limit: 1 });
               if (!r || !r.length) return interaction.editReply({ content: '❌ Track not found.' });
               trackInfo = r[0];`;

const newBlock = `               // Bridge YouTube's highly accurate search to SoundCloud
               let ytVid = null;
               try {
                   const ytRes = await yts(ytQuery);
                   ytVid = ytRes?.videos ? ytRes.videos[0] : ytRes;
               } catch (e) {
                   console.error('yt-search error:', e);
               }

               let scSearchQuery = query;
               let cleanTitleFallback = null;
               if (ytVid && ytVid.title) {
                   const cleanTitle = ytVid.title.replace(/[\\[\\(].*?[\\)\\]]/g, '').trim();
                   cleanTitleFallback = cleanTitle;
                   const cleanAuthor = ytVid.author?.name ? ytVid.author.name.replace(/VEVO|Topic|Official/gi, '').trim() : '';
                   scSearchQuery = \`\${cleanTitle} \${cleanAuthor}\`.trim();
               }

               let r = [];
               // Only search SC if we have a valid text query (either from ytVid or a raw text query)
               if (!query.startsWith('http') || ytVid) {
                   r = await play.search(scSearchQuery, { source: { soundcloud: 'tracks' }, limit: 1 });
                   if ((!r || !r.length) && cleanTitleFallback) {
                       r = await play.search(cleanTitleFallback, { source: { soundcloud: 'tracks' }, limit: 1 });
                   }
                   if (!r || !r.length) {
                       if (!query.startsWith('http')) {
                           r = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
                       }
                   }
               }
               
               if (!r || !r.length) return interaction.editReply({ content: '❌ Track not found.' });
               trackInfo = r[0];`;

if (code.includes(targetBlock)) {
    code = code.replace(targetBlock, newBlock);
    fs.writeFileSync('index.js', code);
    console.log('Successfully patched fallbacks');
} else {
    console.log('Target block not found!');
}
