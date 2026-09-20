function showMenu(req, res) {
  res.render('menu/index', {
    title: 'Menú',
    isAdmin: req.session.user.role === 'admin',
  });
}

module.exports = { showMenu };
