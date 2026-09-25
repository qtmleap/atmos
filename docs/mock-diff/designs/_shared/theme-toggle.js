// テーマ切替の見本用スクリプト。ビルドなし・フレームワークなしの素の JS。
// header の「表示テーマ」ボタン（aria-controls="theme-menu-N"）と、対になる
// .dropdown メニューをこのファイル一本で全画面ぶん配線する。
(() => {
	const ICONS = {
		system:
			'<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
		light:
			'<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
		dark: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
	};
	const LABELS = { system: "システム", light: "ライト", dark: "ダーク" };
	const CHECK = '<path d="m20 6-11 11-5-5"/>';

	const openMenu = (trigger, menu) => {
		trigger.setAttribute("aria-expanded", "true");
		menu.hidden = false;
	};

	const closeMenu = (trigger, menu) => {
		trigger.setAttribute("aria-expanded", "false");
		menu.hidden = true;
	};

	const applyPreference = (preference) => {
		const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
		document.documentElement.classList.toggle(
			"dark",
			preference === "dark" || (preference === "system" && prefersDark),
		);
	};

	const selectPreference = (trigger, menu, item) => {
		const preference = item.dataset.preference;

		menu.querySelectorAll(".dropdown-item").forEach((candidate) => {
			const shortcut = candidate.querySelector(".shortcut");
			if (candidate === item) {
				candidate.setAttribute("aria-current", "true");
				candidate.setAttribute(
					"aria-label",
					`表示テーマ: ${LABELS[preference]}（選択中）`,
				);
				if (!shortcut) {
					const span = document.createElement("span");
					span.className = "shortcut";
					span.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${CHECK}</svg>`;
					candidate.append(span);
				}
			} else {
				candidate.removeAttribute("aria-current");
				candidate.removeAttribute("aria-label");
				if (shortcut) shortcut.remove();
			}
		});

		trigger.querySelector("svg").innerHTML = ICONS[preference];
		trigger.setAttribute("aria-label", `表示テーマ: ${LABELS[preference]}`);

		applyPreference(preference);

		closeMenu(trigger, menu);
		trigger.focus();
	};

	document
		.querySelectorAll('[aria-controls^="theme-menu"]')
		.forEach((trigger) => {
			const menu = document.getElementById(
				trigger.getAttribute("aria-controls"),
			);
			if (!menu) return;

			trigger.addEventListener("click", () => {
				if (menu.hidden) openMenu(trigger, menu);
				else closeMenu(trigger, menu);
			});

			menu.addEventListener("click", (event) => {
				const item = event.target.closest(".dropdown-item");
				if (item) selectPreference(trigger, menu, item);
			});

			document.addEventListener("click", (event) => {
				if (menu.hidden) return;
				if (menu.contains(event.target) || trigger.contains(event.target))
					return;
				closeMenu(trigger, menu);
			});

			document.addEventListener("keydown", (event) => {
				if (event.key === "Escape" && !menu.hidden) {
					closeMenu(trigger, menu);
					trigger.focus();
				}
			});
		});
})();
