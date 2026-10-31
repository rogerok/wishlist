'use strict';
// Design-only scenarios. Product data stays in memory; theme.js persists only the color preference.
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const scenePicker = document.querySelector('#scene');
const announce = (text) => {
  document.querySelector('#announcement').textContent = text;
};
const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );
const paths = {
  gift: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13"/><path d="M12 8H7.5A2.5 2.5 0 1 1 10 5.5L12 8Zm0 0h4.5A2.5 2.5 0 1 0 14 5.5L12 8Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/>',
  link: '<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  external:
    '<path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
  edit: '<path d="m15 5 4 4M4 20l4-1L21 6l-4-4L4 15l-1 6Z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  exit: '<path d="M9 4H4v16h5m5-12 4 4-4 4m-6-4h13"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
const btn = (label, action, variant = '', extra = '') =>
  `<button type="button" class="btn ${variant}" data-action="${action}" ${extra}>${label}</button>`;
const actionMenu = (id, label, content) =>
  `<div class="action-menu"><button type="button" class="icon-btn" id="${escapeHtml(id)}-trigger" popovertarget="${escapeHtml(id)}" aria-label="${escapeHtml(label)}">${icon('more')}</button><div class="action-menu-panel" id="${escapeHtml(id)}" popover="auto" role="group" aria-labelledby="${escapeHtml(id)}-trigger">${content}</div></div>`;
const notice = (text, kind = '', name = 'info') =>
  `<div class="notice ${kind}">${icon(name)}<p>${text}</p></div>`;
const visibility = {
  private: ['lock', 'Только мне'],
  unlisted: ['link', 'По ссылке'],
  public: ['globe', 'Публичный'],
};
const visibilityTag = (value, pill = false) =>
  `<span class="tag ${pill ? 'pill' : ''}">${icon(visibility[value][0])}${visibility[value][1]}</span>`;
const state = {
  name: 'Александра',
  sort: 'createdAt',
  expanded: false,
  mode: 'owner',
  signedIn: true,
  lists: [
    {
      id: 'birthday',
      title: 'На день рождения',
      description:
        'То, чему я буду рада. Для уютных вечеров и маленьких путешествий.',
      occasionDate: '2026-11-14',
      visibility: 'public',
      created: 4,
      key: 'demo-november',
    },
    {
      id: 'home',
      title: 'Для дома',
      description:
        'Понемногу собираю пространство, в которое хочется возвращаться.',
      occasionDate: null,
      visibility: 'unlisted',
      created: 3,
      key: 'demo-home',
    },
    {
      id: 'someday',
      title: 'Когда-нибудь',
      description: 'Большие и маленькие желания. Пусть пока побудут здесь.',
      occasionDate: null,
      visibility: 'private',
      created: 2,
      key: null,
    },
    {
      id: 'summer',
      title: 'Лето за городом',
      description: 'Для длинных дней и неспешных завтраков на веранде.',
      occasionDate: '2026-08-08',
      visibility: 'public',
      created: 1,
      key: 'demo-summer',
    },
  ],
  items: [
    {
      id: 'lamp',
      list: 'birthday',
      title: 'Лампа для чтения',
      comment:
        'С тёплым светом и регулируемым плафоном. Лучше в тёмно-зелёном цвете.',
      amount: '6900',
      currency: 'RUB',
      priority: 'high',
      url: 'https://example.com/reading-lamp',
      reserved: false,
      mine: false,
    },
    {
      id: 'ceramics',
      list: 'birthday',
      title: 'Мастер-класс по керамике',
      comment:
        'Хочу попробовать гончарный круг. Подойдёт сертификат с открытой датой.',
      amount: '4500',
      currency: 'RUB',
      priority: 'high',
      url: '',
      reserved: true,
      mine: false,
    },
    {
      id: 'book',
      list: 'birthday',
      title: 'Книга о японских садах',
      comment:
        'Бумажное издание, можно на английском. Очень люблю большие фотографии.',
      amount: '38',
      currency: 'EUR',
      priority: 'medium',
      url: 'https://example.com/gardens-book',
      reserved: false,
      mine: false,
    },
    {
      id: 'coffee',
      list: 'birthday',
      title: 'Ручная кофемолка',
      comment: 'Компактная, чтобы брать с собой в поездки.',
      amount: '8200',
      currency: 'RUB',
      priority: 'medium',
      url: 'https://example.com/grinder',
      reserved: false,
      mine: false,
    },
    {
      id: 'bag',
      list: 'birthday',
      title: 'Льняная сумка',
      comment: 'Без принта, натурального цвета. С длинными ручками.',
      amount: '2400',
      currency: 'RUB',
      priority: 'low',
      url: '',
      reserved: false,
      mine: false,
    },
    {
      id: 'walk',
      list: 'birthday',
      title: 'Прогулка вместе',
      comment: 'Провести день без спешки: кофе, набережная и разговоры.',
      amount: '',
      currency: 'RUB',
      priority: 'low',
      url: '',
      reserved: false,
      mine: false,
    },
  ],
};
let currentListId = 'birthday';
let activeScene = 'home';
let returnFocus = null;
const verifiedGuestLists = new Set();
const currentList = () =>
  state.lists.find((list) => list.id === currentListId) || state.lists[0];
const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat('ru', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${value}T12:00:00Z`))
    : 'Без даты';
const money = (amount, currency) => {
  if (!amount) return '';
  const value = Number(amount);
  return new Intl.NumberFormat('ru', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
};
const brand = () =>
  `<a class="wordmark" href="#home" aria-label="Wishlist — мои вишлисты">wishlist</a>`;
const navLink = (scene, label) =>
  `<a class="nav-link" href="#${scene}" ${activeScene === scene ? 'aria-current="page"' : ''}>${label}</a>`;
function shell(content) {
  const anonymous = ['guest', 'profile'].includes(activeScene);
  const viewerName = activeScene === 'visitor' ? 'Михаил' : state.name;
  if (anonymous)
    return `<div class="public-shell"><header class="public-nav">${brand()}<a class="btn" href="#login">Войти</a></header><main id="main" class="main" tabindex="-1">${content}</main></div>`;
  return `<div class="shell"><header class="app-header">${brand()}<nav class="nav" aria-label="Основная навигация">${navLink('home', 'Вишлисты')}${navLink('profile', 'Профиль')}${navLink('account', 'Аккаунт')}</nav><a class="account-nav" href="#account"><span class="avatar">${escapeHtml(viewerName.slice(0, 1))}</span><span class="name">${escapeHtml(viewerName)}</span></a></header><main id="main" class="main" tabindex="-1">${content}</main></div>`;
}
function listCard(list, publicView = false) {
  const href = `#${publicView ? 'guest' : 'wishlist'}/${list.id}`;
  const date = list.occasionDate
    ? `<span class="tag">${icon('calendar')}<time datetime="${list.occasionDate}">${escapeHtml(dateLabel(list.occasionDate))}</time></span>`
    : '<span class="tag">Без даты</span>';
  return `<article class="wishlist-card">
    <div class="card-content"><h2><a class="card-title" href="${href}">${escapeHtml(list.title)}</a></h2><p class="card-desc">${escapeHtml(list.description)}</p></div>
    <div class="card-meta">${date}${visibilityTag(list.visibility)}</div>
    <span class="card-open" aria-hidden="true">${icon('arrow')}</span>
  </article>`;
}
function homePage() {
  let lists = [...state.lists];
  if (state.sort === 'occasionDate') {
    const today = '2026-10-22'; // Fixed design clock: same asOf for the full demonstration traversal.
    const group = (list) =>
      !list.occasionDate ? 2 : list.occasionDate >= today ? 0 : 1;
    lists.sort(
      (a, b) =>
        group(a) - group(b) ||
        (group(a) === 1
          ? (b.occasionDate || '').localeCompare(a.occasionDate || '')
          : (a.occasionDate || '').localeCompare(b.occasionDate || '')) ||
        a.id.localeCompare(b.id),
    );
  } else lists.sort((a, b) => b.created - a.created);
  const shown = state.expanded ? lists : lists.slice(0, 3);
  return `<header class="page-head collection-head"><h1>Мои вишлисты</h1>${btn(`${icon('plus')} Создать вишлист`, 'create-list', 'primary')}</header>
    <div class="toolbar collection-toolbar"><label class="sort-field" for="list-sort">Порядок <select id="list-sort"><option value="createdAt" ${state.sort === 'createdAt' ? 'selected' : ''}>Сначала новые</option><option value="occasionDate" ${state.sort === 'occasionDate' ? 'selected' : ''}>По дате повода</option></select></label></div>
    <section class="wishlist-grid" aria-label="Ваши вишлисты">${shown.map((list) => listCard(list)).join('')}</section>
    ${!state.expanded && lists.length > 3 ? `<div class="actions" style="margin-block-start:var(--space-xl)">${btn('Показать ещё', 'load-more')}</div>` : ''}`;
}
const priorityLabel = {
  high: 'Очень хочется',
  medium: 'Буду рада',
  low: 'Было бы приятно',
};
function itemCard(item, owner) {
  const isMine = item.mine === state.mode;
  const status = item.reserved
    ? isMine && !owner
      ? `<span class="reservation-line mine">${icon('check')}Вы дарите этот подарок</span>`
      : `<span class="reservation-line">${icon('lock')}Подарок забронирован</span>`
    : owner
      ? `<span class="reservation-line">Пока никто не выбрал</span>`
      : '';
  const management = owner
    ? actionMenu(
        `item-actions-${item.id}`,
        `Действия с желанием «${item.title}»`,
        `${btn(`${icon('edit')} Изменить`, `edit-item:${item.id}`, 'menu-item')}${item.reserved ? btn(`${icon('lock')} Снять бронь`, `release:${item.id}`, 'menu-item') : ''}${btn(`${icon('trash')} Удалить`, `delete-item:${item.id}`, 'menu-item menu-danger')}`,
      )
    : '';
  const action = owner
    ? ''
    : item.reserved
      ? isMine
        ? btn('Отменить бронь', `cancel:${item.id}`, 'quiet small')
        : ''
      : btn(`${icon('gift')} Я подарю`, `reserve:${item.id}`, 'gift-action');
  return `<article class="item-card"><div class="item-top"><h3>${escapeHtml(item.title)}</h3>${management}</div><div class="item-body"><span class="tag priority ${item.priority === 'high' ? 'high' : ''}">${item.priority === 'high' ? icon('star') : ''}${priorityLabel[item.priority]}</span><p class="item-comment">${escapeHtml(item.comment)}</p><div class="item-details"><p class="price ${!item.amount ? 'empty' : ''}">${item.amount ? escapeHtml(money(item.amount, item.currency)) : 'Цена не указана'}</p>${item.url ? `<a class="item-source" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Ссылка на идею ${icon('external')}</a>` : ''}</div></div><div class="item-bottom">${status}${action}</div></article>`;
}
function wishlistPage() {
  const list = currentList();
  if (!list) return emptyPage();
  const owner = activeScene === 'wishlist';
  if (!owner && list.visibility === 'private') return errorPage('404');
  state.mode = owner ? 'owner' : activeScene === 'guest' ? 'guest' : 'visitor';
  const items = state.items
    .filter((item) => item.list === list.id)
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority],
    );
  const management = owner
    ? `<div class="actions">
    ${btn(`${icon('link')} Поделиться`, 'share')}
    ${actionMenu('wishlist-actions', 'Действия с вишлистом', `${btn(`${icon('edit')} Изменить вишлист`, 'edit-list', 'menu-item')}${btn(`${icon('trash')} Удалить вишлист`, 'delete-list', 'menu-item menu-danger')}`)}
  </div>`
    : '';
  return `<a class="crumb" href="#${owner ? 'home' : 'profile'}">${icon('back')}${owner ? 'Мои вишлисты' : 'Профиль Александры'}</a>
    <header class="page-head">
      <div class="wishlist-head">
        <h1>${escapeHtml(list.title)}</h1>
        <p class="description">${escapeHtml(list.description)}</p>
        <div class="meta">${list.occasionDate ? `<span class="tag">${icon('calendar')}<time datetime="${list.occasionDate}">${escapeHtml(dateLabel(list.occasionDate))}</time></span>` : '<span class="tag">Без даты</span>'}${visibilityTag(list.visibility)}</div>
      </div>
      ${management}
    </header>
    ${notice(owner ? 'Вы видите бронь, но не имя дарителя.' : 'Ваше имя скрыто от владельца и других гостей.', 'privacy-note', 'lock')}
    ${owner ? `<div class="toolbar"><h2>Желания</h2>${btn(`${icon('plus')} Добавить желание`, 'create-item', 'primary')}</div>` : ''}
    ${
      items.length
        ? `<section class="item-grid" aria-label="Желания">${items.map((item) => itemCard(item, owner)).join('')}</section>`
        : `<div class="empty-state item-empty">${icon('gift')}<h2>Здесь пока нет желаний</h2><p>${owner ? 'Начните с одной идеи. Ссылку, цену и комментарий можно добавить позже.' : 'Александра ещё не добавила идеи подарков.'}</p>${owner ? btn('Добавить желание', 'create-item', 'primary') : ''}</div>`
    }`;
}
function profilePage() {
  const lists = state.lists.filter((list) => list.visibility === 'public');
  return `<header class="profile-head"><span class="avatar large">А</span><div><h1>${escapeHtml(state.name)}</h1><p>Публичные вишлисты</p></div></header><section class="wishlist-grid" aria-label="Публичные вишлисты">${lists.map((list) => listCard(list, true)).join('')}</section>`;
}
function nameField(value) {
  return `<div class="field"><label for="displayName">Как вас зовут</label><input id="displayName" name="displayName" value="${escapeHtml(value)}" maxlength="100" required autocomplete="nickname" aria-describedby="displayName-help"><span id="displayName-help" class="help">От 1 до 100 символов. Это имя видно в публичном профиле.</span></div>`;
}
function accountPage() {
  return `<header class="page-head"><div><h1>Аккаунт</h1><p class="lede">Имя видно в профиле, почта остаётся приватной.</p></div></header><section class="form-layout"><form id="account-form">${nameField(state.name)}<div class="actions"><button class="btn primary" type="submit">Сохранить имя</button><span class="saved" role="status" id="account-saved"></span></div></form><div class="account-email"><div><p>Электронная почта</p><small>alexandra@example.com</small></div><span class="tag">${icon('lock')}Только для входа</span></div><hr class="form-divider"><h2>Текущий сеанс</h2><p class="help" style="margin-block:var(--space-md)">Выход завершит только этот сеанс. На других устройствах вход сохранится.</p>${btn(`${icon('exit')} Выйти из аккаунта`, 'logout')}</section>`;
}
function emailField() {
  return '<div class="field"><label for="email">Электронная почта</label><input id="email" name="email" type="email" autocomplete="email" maxlength="255" required placeholder="you@example.com" aria-describedby="email-help"><span id="email-help" class="help">Не будет видна другим посетителям.</span></div>';
}
function passwordField(confirm = false) {
  const id = confirm ? 'passwordConfirm' : 'password';
  return `<div class="field"><label for="${id}">${confirm ? 'Повторите пароль' : 'Пароль'}</label><div class="password-wrap"><input id="${id}" name="${id}" type="password" minlength="8" maxlength="100" required autocomplete="${activeScene === 'signup' ? 'new-password' : 'current-password'}" aria-describedby="${id}-help"><button type="button" class="icon-btn" data-action="toggle-password:${id}" aria-label="Показать пароль" aria-pressed="false">${icon('eye')}</button></div><span class="help" id="${id}-help">${confirm ? 'Пароли должны совпадать.' : '8–100 символов: a–z, A–Z, цифра и спецсимвол. Без пробелов.'}</span></div>`;
}
function authPage() {
  const signup = activeScene === 'signup';
  return `<div class="auth-shell">
    <header class="auth-top">${brand()}<a class="btn quiet" href="#${signup ? 'login' : 'signup'}">${signup ? 'Войти' : 'Регистрация'}</a></header>
    <main id="main" class="auth-layout" tabindex="-1">
      <section class="auth-form"><h1>${signup ? 'Создать аккаунт' : 'Войти в Wishlist'}</h1><p class="lede">${signup ? 'Сохраняйте желания и делитесь вишлистами.' : 'Используйте почту и пароль от аккаунта.'}</p>
        <form id="auth-form">${signup ? nameField('') : ''}${emailField()}${passwordField()}${signup ? passwordField(true) : ''}<div id="auth-error" class="auth-error" role="alert"></div><button class="btn primary full" type="submit">${signup ? 'Создать аккаунт' : 'Войти'}</button></form>
        <p class="auth-bottom">${signup ? 'Уже есть аккаунт?' : 'Ещё нет аккаунта?'} <a href="#${signup ? 'login' : 'signup'}">${signup ? 'Войти' : 'Зарегистрироваться'}</a></p>
      </section>
    </main>
  </div>`;
}
function emptyPage() {
  return `<div class="empty-state">${icon('gift')}<h1>Пока нет вишлистов</h1><p>Создайте список для особенного повода или просто так. По умолчанию его видите только вы.</p>${btn('Создать вишлист', 'create-list', 'primary')}</div>`;
}
function loadingPage() {
  return `<header class="page-head"><h1>Мои вишлисты</h1></header><p class="help" role="status">Загружаем вишлисты…</p><div class="loading-grid" aria-busy="true" aria-label="Загрузка">${Array.from({ length: 3 }, () => '<div class="loading-row" aria-hidden="true"><div class="skeleton"></div><div class="skeleton line"></div><div class="skeleton meta"></div></div>').join('')}</div>`;
}
function errorPage(type) {
  const content = {
    404: [
      'Вишлист недоступен',
      'Проверьте адрес или попросите владельца прислать актуальную ссылку.',
    ],
    401: [
      'Нужно войти снова',
      'Сеанс завершён. Войдите в аккаунт, чтобы продолжить.',
    ],
    503: [
      'Не удалось загрузить вишлисты',
      'Сервис временно недоступен. Попробуйте загрузить список ещё раз.',
    ],
    500: [
      'Не удалось выполнить действие',
      'Не повторяйте изменение сразу: сначала проверьте, сохранился ли результат.',
    ],
    conflict: [
      'Этот подарок уже выбрали',
      'Другой человек успел забронировать его раньше. Выберите другое желание.',
    ],
    magic: [
      'Ссылка больше не действует',
      'Она уже использована или срок входа истёк. Запросите новое письмо для этого вишлиста.',
    ],
  }[type];
  return `<div class="empty-state">${icon(type === '404' ? 'lock' : 'info')}<h1>${content[0]}</h1><p>${content[1]}</p>${type === '401' ? '<a class="btn primary" href="#login">Войти</a>' : type === 'magic' ? btn('Запросить письмо', 'guest-retry', 'primary') : type === '503' ? btn('Загрузить заново', 'retry', 'primary') : '<a class="btn" href="#home">К моим вишлистам</a>'}${['500', '503'].includes(type) ? '<p class="help inline-code">Демо-код обращения: 0123456789abcdef0123456789abcdef</p>' : ''}</div>`;
}
function statesPage() {
  const samples = [
    ['Обычное', '<button class="btn primary" type="button">Сохранить</button>'],
    [
      'Наведение',
      '<button class="btn primary is-hover" type="button">Сохранить</button>',
    ],
    [
      'Фокус',
      '<button class="btn primary is-focus" type="button">Сохранить</button>',
    ],
    [
      'Нажатие',
      '<button class="btn primary is-active" type="button">Сохранить</button>',
    ],
    ['Недоступно', '<button class="btn primary" disabled>Сохранить</button>'],
    [
      'Сохранение',
      '<button class="btn primary" data-state="loading" disabled aria-busy="true">Сохраняем…</button>',
    ],
    [
      'Ошибка',
      '<button class="btn primary" data-state="error" type="button">Повторить</button>',
    ],
    [
      'Сохранено',
      `<button class="btn primary" data-state="success" type="button">${icon('check')}Сохранено</button>`,
    ],
  ];
  return `<header class="page-head"><div><h1>Компоненты</h1><p class="lede">Типографика, цвета и состояния интерфейса.</p></div></header>
    <section class="demo-section"><h2>Палитра</h2><div class="swatch-grid"><div class="swatch paper">Фон</div><div class="swatch secondary">Поверхность</div><div class="swatch ink">Текст</div><div class="swatch accent">Акцент</div></div><p class="help">Переключите тему в верхней панели: меняется вся система, включая формы, диалоги и ошибки.</p></section>
    <section class="demo-section"><h2>Восемь состояний действия</h2><div class="state-grid">${samples.map(([label, html]) => `<div class="state-sample"><small>${label}</small>${html}</div>`).join('')}</div></section>
    <section class="demo-section"><h2>Поля и обратная связь</h2><div class="form-layout"><div class="field"><label for="sample-error">Название вишлиста</label><input id="sample-error" aria-invalid="true" aria-describedby="sample-error-help" value=""><span class="help error" id="sample-error-help">Укажите название: от 1 до 255 символов.</span></div>${notice('Имя сохранено. Изменение видно в профиле.', 'success', 'check')}${notice('Подарок уже забронирован. Выберите другое желание.', 'warning', 'lock')}</div></section>
    <section class="demo-section"><h2>Сценарии сбоев и ожидания</h2><div class="actions">${[
      ['empty', 'Пусто'],
      ['loading', 'Загрузка'],
      ['401', 'Сеанс истёк'],
      ['404', 'Недоступно'],
      ['500', 'Ошибка 500'],
      ['503', 'Ошибка 503'],
      ['conflict', 'Гонка брони'],
      ['magic', 'Ссылка истекла'],
    ]
      .map(([key, label]) => btn(label, `show-state:${key}`))
      .join('')}</div></section>
    <section class="demo-section"><h2>Приватность — часть заботы</h2><p class="help">Владелец видит статус брони, но не имя, аватар или почту дарителя. Почта гостя не превращает его в зарегистрированного пользователя. У брони нет таймера истечения.</p></section>`;
}
function render() {
  const focusedMenuTrigger = document.activeElement?.matches(
    '.action-menu > button',
  )
    ? document.activeElement.id
    : null;
  const [route, query = ''] = location.hash.replace(/^#/, '').split('?');
  const [scene, id] = route.split('/');
  activeScene = [
    'home',
    'wishlist',
    'visitor',
    'guest',
    'profile',
    'account',
    'login',
    'signup',
    'states',
    'empty',
    'loading',
    '401',
    '404',
    '500',
    '503',
    'conflict',
    'magic',
  ].includes(scene)
    ? scene
    : 'home';
  const requestedList = id ? state.lists.find((list) => list.id === id) : null;
  const key = new URLSearchParams(query).get('key');
  if ((id && !requestedList) || (key && key !== requestedList?.key))
    activeScene = '404';
  if (requestedList) currentListId = id;
  scenePicker.value = scenePicker.querySelector(
    `option[value="${activeScene}"]`,
  )
    ? activeScene
    : 'states';
  const pages = {
    home: homePage,
    wishlist: wishlistPage,
    visitor: wishlistPage,
    guest: wishlistPage,
    profile: profilePage,
    account: accountPage,
    states: statesPage,
    empty: emptyPage,
    loading: loadingPage,
  };
  app.innerHTML = ['login', 'signup'].includes(activeScene)
    ? authPage()
    : shell(pages[activeScene] ? pages[activeScene]() : errorPage(activeScene));
  if (['login', 'signup'].includes(activeScene))
    app
      .querySelector('.auth-form')
      .insertAdjacentHTML(
        'beforeend',
        `<details class="auth-demo"><summary>Демо-состояния формы</summary><div class="actions">${btn(activeScene === 'signup' ? 'Email занят' : 'Неверные данные', `auth-error:${activeScene === 'signup' ? 'duplicate' : 'credentials'}`, 'small')}${btn('Сервис недоступен', 'auth-error:unavailable', 'small')}</div></details>`,
      );
  document.title = `${{ home: 'Мои вишлисты', account: 'Аккаунт', profile: 'Профиль', login: 'Вход', signup: 'Регистрация', states: 'Компоненты' }[activeScene] || currentList()?.title || 'Состояния'} — Wishlist · дизайн`;
  if (focusedMenuTrigger)
    (
      document.getElementById(focusedMenuTrigger) ||
      document.querySelector('#main')
    )?.focus({ preventScroll: true });
}
function go(scene) {
  if (location.hash === `#${scene}`) render();
  else location.hash = scene;
}
function openModal(title, subtitle, content) {
  if (!modal.open) returnFocus = document.activeElement;
  modal.innerHTML = `<div class="modal-head"><div><h2 id="dialog-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div><button type="button" class="icon-btn" data-action="close" aria-label="Закрыть диалог">${icon('close')}</button></div>${content}`;
  modal.showModal();
  const field = modal.querySelector(
    'input:not([type="radio"]):not([type="checkbox"]), textarea, select',
  );
  (
    field ||
    modal.querySelector('.modal-actions button') ||
    modal.querySelector('button')
  ).focus();
}
function closeModal() {
  modal.close();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}
const dialogActions = (submit, danger = false) =>
  `<div class="modal-actions">${btn('Отмена', 'close', 'quiet')}<button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${submit}</button></div>`;
const radioVisibility = (selected) =>
  `<fieldset><legend>Кто увидит вишлист</legend>${Object.entries(visibility)
    .map(
      ([key, [symbol, label]]) =>
        `<label class="radio-option"><input type="radio" name="visibility" value="${key}" ${key === selected ? 'checked' : ''}><span><b>${icon(symbol)} ${label}</b><small>${key === 'private' ? 'Только вы. Ссылка не даёт доступа.' : key === 'unlisted' ? 'Те, у кого есть актуальная ссылка. Не виден в профиле.' : 'Виден в публичном профиле и по ссылке.'}</small></span></label>`,
    )
    .join('')}</fieldset>`;
function listDialog(edit = false) {
  const list = edit
    ? currentList()
    : { title: '', description: '', occasionDate: '', visibility: 'private' };
  const min = new Date(Date.UTC(2026, 9, 21)).toISOString().slice(0, 10);
  openModal(
    edit ? 'Изменить вишлист' : 'Новый вишлист',
    'Для особенного повода или просто так.',
    `<form id="list-form" data-edit="${edit}"><div class="field"><label for="list-title">Название</label><input id="list-title" name="title" maxlength="255" required value="${escapeHtml(list.title)}" placeholder="Например, на день рождения" aria-describedby="list-title-help"><span class="help" id="list-title-help">От 1 до 255 символов.</span></div><div class="field"><label for="description">Описание <span class="help">· необязательно</span></label><textarea id="description" name="description" maxlength="1000">${escapeHtml(list.description)}</textarea></div><div class="field"><label for="occasionDate">Дата повода <span class="help">· необязательно</span></label><input id="occasionDate" name="occasionDate" type="date" min="${min}" max="2031-10-22" value="${list.occasionDate || ''}" aria-describedby="date-help"><span class="help" id="date-help">Одна дата, без ежегодного повторения.</span></div>${radioVisibility(list.visibility)}<div id="list-error" role="alert"></div>${dialogActions(edit ? 'Сохранить' : 'Создать вишлист')}</form>`,
  );
  if (edit && list.occasionDate < min)
    modal.querySelector('#occasionDate').removeAttribute('min');
}
function itemDialog(itemId) {
  const item = state.items.find((entry) => entry.id === itemId) || {
    title: '',
    comment: '',
    url: '',
    amount: '',
    currency: 'RUB',
    priority: 'medium',
  };
  openModal(
    itemId ? 'Изменить желание' : 'Добавить желание',
    'Начните с названия. Остальное можно оставить на потом.',
    `<form id="item-form" data-id="${itemId || ''}"><div class="field"><label for="item-title">Название</label><input id="item-title" name="title" required value="${escapeHtml(item.title)}"></div><div class="field"><label for="source-url">Ссылка на идею · необязательно</label><input id="source-url" name="url" type="url" value="${escapeHtml(item.url)}" placeholder="https://example.com/idea" aria-describedby="url-help"><span class="help" id="url-help">Ссылка должна начинаться с https://.</span></div>${btn('Предпросмотр по ссылке', 'import-preview', 'small')}<div id="import-result" aria-live="polite"></div><hr class="form-divider"><div class="form-row"><div class="field"><label for="amount">Цена · необязательно</label><input id="amount" name="amount" inputmode="decimal" value="${escapeHtml(item.amount)}" placeholder="4500,00"></div><div class="field"><label for="currency">Валюта этой идеи</label><select id="currency" name="currency">${['RUB', 'EUR', 'USD'].map((value) => `<option ${value === item.currency ? 'selected' : ''}>${value}</option>`).join('')}</select></div></div><div class="field"><label for="priority">Насколько хочется</label><select id="priority" name="priority">${Object.entries(
      priorityLabel,
    )
      .map(
        ([key, label]) =>
          `<option value="${key}" ${key === item.priority ? 'selected' : ''}>${label}</option>`,
      )
      .join(
        '',
      )}</select></div><div class="field"><label for="comment">Комментарий · необязательно</label><textarea id="comment" name="comment">${escapeHtml(item.comment)}</textarea></div><div id="item-error" role="alert"></div>${dialogActions(itemId ? 'Сохранить' : 'Добавить желание')}</form>`,
  );
}
function sharingDialog() {
  const list = currentList();
  openModal(
    'Поделиться вишлистом',
    'Сначала выберите, кому он будет доступен.',
    `<form id="sharing-form">${radioVisibility(list.visibility)}${list.visibility !== 'private' ? `<div class="copy-row"><div class="field"><label for="share-url">Ссылка на вишлист</label><input id="share-url" readonly value="${escapeHtml(`${location.href.split('#')[0]}#guest/${list.id}?key=${list.key}`)}"></div>${btn('Копировать', 'copy-share', 'small')}</div>${btn('Заменить ссылку', 'rotate-link', 'quiet small')}` : notice('Сейчас вишлист видите только вы. Чтобы поделиться, измените доступ.')}${notice('При уменьшении видимости старая ссылка перестаёт работать. Подтвердите изменение, прежде чем отправлять новую ссылку.', 'warning')}${dialogActions('Сохранить доступ')}</form>`,
  );
}
function confirmation(title, text, action, label = 'Подтвердить') {
  openModal(
    title,
    '',
    `${notice(text, 'warning')}<form id="confirm-form" data-confirm="${action}">${dialogActions(label, true)}</form>`,
  );
}
let pendingGuestItem = null;
function guestDialog(itemId) {
  pendingGuestItem = itemId;
  const item = state.items.find((entry) => entry.id === itemId);
  openModal(
    'Подарить без регистрации',
    `Желание: ${escapeHtml(item.title)}`,
    `<form id="guest-form">${emailField()}${notice('Отправим ссылку для подтверждения почты и бронирования этого подарка. До перехода по ссылке подарок остаётся свободным.', '', 'mail')}${notice('Это доступ только к этому вишлисту, не вход в аккаунт. Имя и почта не видны Александре и другим посетителям.', '', 'lock')}${dialogActions('Получить ссылку')}</form>`,
  );
}
let importBaseline = null;
function showImportPreview() {
  const url = modal.querySelector('#source-url').value;
  const result = modal.querySelector('#import-result');
  if (!url.startsWith('https://')) {
    result.innerHTML = notice(
      'Укажите HTTPS-ссылку. Ручной ввод остаётся доступным.',
      'error',
    );
    return;
  }
  importBaseline = {
    title: modal.querySelector('#item-title').value,
    amount: modal.querySelector('#amount').value,
  };
  result.innerHTML =
    notice(
      'Демонстрационные предложения, не данные магазина. Выберите поля, которые хотите скопировать. Автоматического обновления нет.',
    ) +
    `<div class="preview-fields"><label class="preview-check"><input type="checkbox" id="import-title">Название: Настольная лампа</label><label class="preview-check"><input type="checkbox" id="import-price">Цена: 6 900 ₽</label></div><div class="actions">${btn('Применить выбранное', 'apply-import', 'small')}${btn('Показать сбой импорта', 'import-fail', 'quiet small')}</div>`;
}
async function copyText(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    button.innerHTML = `${icon('check')}Скопировано`;
    announce('Ссылка скопирована');
  } catch {
    button.textContent = 'Выделите ссылку';
    const input = modal.querySelector('#share-url');
    if (input) {
      input.focus();
      input.select();
    } else
      announce(
        'Браузер не разрешил копирование. Скопируйте адрес из адресной строки.',
      );
  }
}
async function actionHandler(action, button) {
  const [name, id] = action.split(':');
  if (name === 'close') return closeModal();
  if (name === 'create-list') return listDialog();
  if (name === 'edit-list') return listDialog(true);
  if (name === 'load-more') {
    state.expanded = true;
    render();
    announce('Загружены следующие вишлисты. Больше списков нет.');
    return;
  }
  if (name === 'create-item' || name === 'edit-item') return itemDialog(id);
  if (name === 'share') return sharingDialog();
  if (name === 'copy-share')
    return copyText(modal.querySelector('#share-url').value, button);
  if (name === 'rotate-link')
    return confirmation(
      'Заменить ссылку?',
      'Все ранее отправленные ссылки на этот вишлист перестанут работать. Доступ через публичный профиль сохранится для публичного вишлиста.',
      'rotate-link',
      'Заменить ссылку',
    );
  if (name === 'delete-list')
    return confirmation(
      'Удалить вишлист?',
      'Все желания будут удалены. Активные брони завершатся, а держателям будут запланированы уведомления. Их имена останутся скрытыми. Восстановление не предусмотрено.',
      'delete-list',
      'Удалить вишлист',
    );
  if (name === 'delete-item')
    return confirmation(
      'Удалить желание?',
      'Желание будет удалено. Если оно забронировано, бронь завершится. Восстановление не предусмотрено.',
      `delete-item:${id}`,
      'Удалить желание',
    );
  if (name === 'release')
    return confirmation(
      'Освободить подарок?',
      'Другой человек уже выбрал этот подарок. Его бронь будет снята; держателю будет запланировано нейтральное уведомление. Вы не узнаете, кто это.',
      `release:${id}`,
      'Снять бронь',
    );
  if (name === 'reserve') {
    if (state.mode === 'guest' && !verifiedGuestLists.has(currentListId))
      return guestDialog(id);
    const item = state.items.find((entry) => entry.id === id);
    if (item.reserved) return go('conflict');
    item.reserved = true;
    item.mine = state.mode;
    render();
    announce('Вы забронировали подарок. Бронь действует до явной отмены.');
    return;
  }
  if (name === 'cancel')
    return confirmation(
      'Отменить свою бронь?',
      'Подарок снова станет доступен другим. Автоматического срока у брони нет.',
      `cancel:${id}`,
      'Отменить бронь',
    );
  if (name === 'logout') {
    state.signedIn = false;
    return go('login');
  }
  if (name === 'toggle-password') {
    const input = document.getElementById(id);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute(
      'aria-label',
      show ? 'Скрыть пароль' : 'Показать пароль',
    );
    return;
  }
  if (name === 'show-state') return go(id);
  if (name === 'retry') return go('home');
  if (name === 'guest-retry') {
    currentListId = 'birthday';
    return guestDialog('lamp');
  }
  if (name === 'verify-guest') {
    const item = state.items.find((entry) => entry.id === pendingGuestItem);
    closeModal();
    verifiedGuestLists.add(item.list);
    if (item.reserved) return go('conflict');
    item.reserved = true;
    item.mine = 'guest';
    state.mode = 'guest';
    go(`guest/${item.list}`);
    announce(
      'Демонстрационная почта подтверждена. Подарок забронирован только в этом вишлисте.',
    );
    return;
  }
  if (name === 'guest-link-error') {
    closeModal();
    return go('magic');
  }
  if (name === 'auth-error') {
    const messages = {
      credentials:
        'Неверная почта или пароль. Проверьте оба поля и попробуйте снова.',
      duplicate:
        'Эта почта уже используется. Войдите в аккаунт или укажите другую почту.',
      unavailable:
        'Сервис временно недоступен. Не удалось подтвердить результат. Демо-код обращения: 0123456789abcdef0123456789abcdef.',
    };
    setFormError('auth-error', messages[id]);
    return;
  }
  if (name === 'import-preview') return showImportPreview();
  if (name === 'import-fail') {
    modal.querySelector('#import-result').innerHTML = notice(
      'Не удалось получить данные по ссылке. Заполните желание вручную: введённые значения сохранены.',
      'error',
    );
    return;
  }
  if (name === 'apply-import') {
    const changed =
      modal.querySelector('#item-title').value !== importBaseline.title ||
      modal.querySelector('#amount').value !== importBaseline.amount;
    if (changed) {
      modal.querySelector('#import-result').innerHTML = notice(
        'После предпросмотра вы изменили поля. Предложения не применены, чтобы не затереть правки. Запросите предпросмотр заново.',
        'warning',
      );
      return;
    }
    if (modal.querySelector('#import-title').checked)
      modal.querySelector('#item-title').value = 'Настольная лампа';
    if (modal.querySelector('#import-price').checked) {
      modal.querySelector('#amount').value = '6900';
      modal.querySelector('#currency').value = 'RUB';
    }
    modal.querySelector('#import-result').innerHTML = notice(
      'Выбранные значения скопированы. Проверьте их перед сохранением.',
      'success',
      'check',
    );
  }
}
let actionMenuScrollY = 0;
const closeActionMenus = () => {
  document.querySelector('.action-menu-panel:popover-open')?.hidePopover();
};
document.addEventListener(
  'beforetoggle',
  (event) => {
    if (
      !event.target.matches?.('.action-menu-panel') ||
      event.newState !== 'open'
    )
      return;
    actionMenuScrollY = scrollY;
    event.target.dataset.positioning = '';
  },
  true,
);
document.addEventListener(
  'toggle',
  (event) => {
    const panel = event.target;
    if (!panel.matches?.('.action-menu-panel') || event.newState !== 'open')
      return;
    const trigger = document
      .getElementById(`${panel.id}-trigger`)
      .getBoundingClientRect();
    const menu = panel.getBoundingClientRect();
    const gap = 8;
    const width = document.documentElement.clientWidth;
    const below = trigger.bottom + gap;
    const top =
      below + menu.height <= innerHeight - gap
        ? below
        : Math.max(gap, trigger.top - menu.height - gap);
    panel.style.top = `${top}px`;
    panel.style.left = `${Math.max(gap, Math.min(trigger.right - menu.width, width - menu.width - gap))}px`;
    delete panel.dataset.positioning;
  },
  true,
);
window.addEventListener('resize', closeActionMenus);
window.addEventListener(
  'scroll',
  () => {
    // Scrolling the trigger into view can deliver its scroll event after the menu opens.
    if (scrollY !== actionMenuScrollY) closeActionMenus();
  },
  { passive: true },
);
document.addEventListener('click', (event) => {
  if (event.target.closest('.skip')) {
    event.preventDefault();
    document.querySelector('#main')?.focus();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (button) {
    const panel = button.closest('.action-menu-panel');
    if (panel) {
      const trigger = document.getElementById(`${panel.id}-trigger`);
      panel.hidePopover();
      trigger.focus({ preventScroll: true });
    }
    actionHandler(button.dataset.action, button);
  }
});
scenePicker.addEventListener('change', () => go(scenePicker.value));
document.addEventListener('change', (event) => {
  if (event.target.id === 'list-sort') {
    state.sort = event.target.value;
    state.expanded = false;
    render();
  }
});
window.addEventListener('hashchange', () => {
  if (modal.open) closeModal();
  render();
  document.querySelector('#main')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
});
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    const rect = modal.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeModal();
  }
});
modal.addEventListener('cancel', () => {
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
});
function setFormError(id, text) {
  const element = document.getElementById(id);
  element.innerHTML = notice(escapeHtml(text), 'error');
}
function updateVisibility(list, next) {
  const rank = { private: 0, unlisted: 1, public: 2 };
  if (rank[next] < rank[list.visibility])
    list.key = next === 'private' ? null : `demo-${Date.now()}`;
  if (next !== 'private' && !list.key) list.key = `demo-${Date.now()}`;
  list.visibility = next;
}
function saveList(form, data) {
  const title = data.get('title').trim();
  if (!title) {
    setFormError(
      'list-error',
      'Название не может состоять из пробелов. Укажите от 1 до 255 символов.',
    );
    return;
  }
  const original = form.dataset.edit === 'true' ? currentList() : null;
  const next = data.get('visibility');
  const apply = () => {
    const value = {
      title,
      description: data.get('description').trim() || null,
      occasionDate: data.get('occasionDate') || null,
    };
    if (original) {
      Object.assign(original, value);
      updateVisibility(original, next);
      currentListId = original.id;
    } else {
      const list = {
        id: `demo-${Date.now()}`,
        ...value,
        visibility: 'private',
        key: null,
        created: Date.now(),
      };
      updateVisibility(list, next);
      state.lists.push(list);
      currentListId = list.id;
    }
    closeModal();
    go(`wishlist/${currentListId}`);
    announce('Вишлист сохранён в памяти прототипа.');
  };
  const rank = { private: 0, unlisted: 1, public: 2 };
  if (original && rank[next] < rank[original.visibility]) {
    openModal(
      'Сделать вишлист менее видимым?',
      '',
      `${notice('Прежняя ссылка перестанет работать. Поделитесь новой ссылкой, если хотите сохранить доступ для близких.', 'warning')}<div class="modal-actions">${btn('Отмена', 'close', 'quiet')}<button type="button" class="btn primary" id="confirm-list-visibility">Изменить доступ</button></div>`,
    );
    modal
      .querySelector('#confirm-list-visibility')
      .addEventListener('click', apply, { once: true });
  } else apply();
}
document.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  const data = new FormData(form);
  if (form.id === 'list-form') return saveList(form, data);
  if (form.id === 'item-form') {
    const title = data.get('title').trim();
    const amount = data.get('amount').trim().replace(',', '.');
    const url = data.get('url').trim();
    if (!title)
      return setFormError('item-error', 'Укажите непустое название желания.');
    if (url && !url.startsWith('https://'))
      return setFormError('item-error', 'Ссылка должна начинаться с https://.');
    if (
      amount &&
      (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) > 1000000)
    )
      return setFormError(
        'item-error',
        'Укажите цену до 1 000 000, не больше двух знаков после запятой. Точность — предположение прототипа, не утверждённый контракт.',
      );
    const value = {
      title,
      amount,
      currency: data.get('currency'),
      priority: data.get('priority'),
      comment: data.get('comment').trim(),
      url,
    };
    if (form.dataset.id)
      Object.assign(
        state.items.find((entry) => entry.id === form.dataset.id),
        value,
      );
    else
      state.items.push({
        id: `demo-${Date.now()}`,
        list: currentListId,
        ...value,
        reserved: false,
        mine: false,
      });
    closeModal();
    render();
    announce('Желание сохранено в прототипе.');
    return;
  }
  if (form.id === 'account-form') {
    const name = data.get('displayName').trim();
    if (!name) {
      const input = form.querySelector('input');
      input.setAttribute('aria-invalid', 'true');
      document.querySelector('#displayName-help').textContent =
        'Имя не может состоять из пробелов.';
      return;
    }
    state.name = name;
    render();
    document.querySelector('#account-saved').textContent = 'Имя сохранено';
    announce('Имя сохранено');
    return;
  }
  if (form.id === 'auth-form') {
    const password = data.get('password');
    const validPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#@$!%^&*?_+=\-{}[\]:;"'<>,.()|\\`~/])[A-Za-z\d#$@!%^&*?_+=\-{}[\]:;"'<>,.()|\\`~/]{8,100}$/;
    if (!validPassword.test(password))
      return setFormError(
        'auth-error',
        'Проверьте пароль: нужны латинские буквы двух регистров, цифра и разрешённый спецсимвол, например !, @ или #. Без пробелов.',
      );
    if (activeScene === 'signup' && password !== data.get('passwordConfirm')) {
      document
        .querySelector('#passwordConfirm')
        .setAttribute('aria-invalid', 'true');
      return setFormError(
        'auth-error',
        'Пароли не совпадают. Повторите тот же пароль.',
      );
    }
    if (activeScene === 'signup' && !data.get('displayName').trim())
      return setFormError('auth-error', 'Укажите непустое имя.');
    if (activeScene === 'signup') state.name = data.get('displayName').trim();
    state.signedIn = true;
    form.reset();
    go('home');
    announce('Демонстрационный вход выполнен. Данные не отправлялись.');
    return;
  }
  if (form.id === 'guest-form') {
    openModal(
      'Проверьте почту',
      'Письмо не отправлено: это демонстрация сценария.',
      `${notice('После настоящего перехода по ссылке сервер подтвердит почту и попробует занять подарок. Если его уже выбрали, появится конфликт.', '', 'mail')}<p class="help">Для просмотра следующего экрана используйте кнопку имитации. Гостевой доступ ограничен одним вишлистом.</p><div class="modal-actions">${btn('Ссылка истекла', 'guest-link-error', 'quiet')}${btn('Имитировать переход', 'verify-guest', 'primary')}</div>`,
    );
    return;
  }
  if (form.id === 'sharing-form') {
    const list = currentList();
    const next = data.get('visibility');
    const rank = { private: 0, unlisted: 1, public: 2 };
    if (rank[next] < rank[list.visibility]) {
      openModal(
        'Изменить доступ?',
        '',
        `${notice('Старая ссылка перестанет работать. Это не отменяет активные брони само по себе.', 'warning')}<div class="modal-actions">${btn('Отмена', 'close', 'quiet')}<button class="btn primary" id="confirm-sharing" type="button">Изменить доступ</button></div>`,
      );
      modal.querySelector('#confirm-sharing').addEventListener(
        'click',
        () => {
          updateVisibility(list, next);
          closeModal();
          render();
        },
        { once: true },
      );
    } else {
      updateVisibility(list, next);
      closeModal();
      render();
    }
    return;
  }
  if (form.id === 'confirm-form') {
    const [action, id] = form.dataset.confirm.split(':');
    if (action === 'rotate-link') currentList().key = `demo-${Date.now()}`;
    if (action === 'delete-list') {
      state.items = state.items.filter((item) => item.list !== currentListId);
      state.lists = state.lists.filter((list) => list.id !== currentListId);
      currentListId = state.lists[0]?.id;
      closeModal();
      go(state.lists.length ? 'home' : 'empty');
      return;
    }
    if (action === 'delete-item')
      state.items = state.items.filter((item) => item.id !== id);
    if (action === 'release' || action === 'cancel') {
      const item = state.items.find((entry) => entry.id === id);
      item.reserved = false;
      item.mine = false;
    }
    closeModal();
    render();
    announce('Демонстрационное действие выполнено.');
  }
});
render();
