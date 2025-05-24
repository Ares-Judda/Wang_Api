const crypto = require('crypto');

/**
 * Genera una clave secreta aleatoria de 32 bytes y la exporta.
 * La clave se utiliza para firmar y verificar tokens, asegurando la
 * integridad y confidencialidad de los datos.
 */
const SECRET_KEY = crypto.randomBytes(32).toString('hex');

try{
    console.log(`Clave generada: ${SECRET_KEY}`);
}catch(error){
    console.log(`Error al generar la clave: ${error}`)
}

module.exports = {
    SECRET_KEY
};