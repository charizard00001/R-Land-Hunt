function handleError(err, req, res, next) {
    console.log(err);
    res.status(500).send('Something broke!');
}

module.exports = handleError;