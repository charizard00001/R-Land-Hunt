function addCsrfToken(req, res, next) {
  res.locals.csrfToken = req.csrfToken();
  console.log("csrftoken"+res.locals.csrfToken);
  next();
}

module.exports = addCsrfToken;