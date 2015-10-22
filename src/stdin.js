export default {
  read(message, callback) {
    let data = "";

    process.stdout.write(message);

    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', function(chunk) {
      data += chunk;

      // Someone hit [enter]
      if (chunk.length === 1 && chunk.charCodeAt(chunk[0]) === 10) {
        callback(data);
        process.stdin.pause();
      }
    });

    process.stdin.on('end', function() {
      callback(data);
      process.stdout.write('end');
    });
  }
}
