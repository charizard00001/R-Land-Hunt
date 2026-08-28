function checkAuthStatus(req, res, next) {
  const uid = req.session.uid;
  console.log("uid "+uid);
  if (!uid) {
    res.locals.isAuth = false;
    return next();
  }

  res.locals.uid = uid;
  res.locals.isAuth = true;

  console.log(res.locals);

  next();
}

module.exports = checkAuthStatus;