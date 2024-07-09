const startDate = new Date();
let actions = {};

const navigationButtonCollection = {
	37: { 
		direction: 4,
		eventName: "swipeleft"
	},
	38: { 
		direction: 16,
		eventName: "swipeup"
	},
	39: { 
		direction: 2,
		eventName: "swiperight"
	},
	40: {
		direction: 8,
		eventName: "swipedown"
	}
};

jQuery(function() {
	setInitialValues();
	generateHomePage();
	generateStoryBoard();
	setNavigationEvents();
	subscribeTrackEvents();
	replaceMacros();
	handleFlexadinEvents();
});

function setInitialValues() {
	if (!sessionStorage.getItem("currentLocation")) {
		sessionStorage.setItem("currentLocation", document.location.href);
	}
	if (sessionStorage.getItem("actions")) {
		actions = JSON.parse(sessionStorage.getItem("actions"));
		actions.lastSlide = {
			id: $("body")[0].id,
			start: new Date()
		};
	} else {
		actions = {
			start: new Date(),
			end: "",
			chapters: [],
			slides: [],
			kpis: [],
			shows: [],
			lastSlide: {
				id: $("body")[0].id,
				start: new Date()
			}
		};
	}
	publishMessageToApp();
}

function generateHomePage() {
	const el = $("body")[0];
	if (el.id !== "homePage") {
		return;
	}

	const chapterKeys = Object.keys(presentation.chapters);
	if (chapterKeys.length === 1) {
		openChapter(chapterKeys[0]);
		return;
	}

	$.each(presentation.chapters, function(id, obj) {
		const $link = $("<a>", {id: id, class: "home-menu-link btn", href: "#", text: obj.name});
		$link.click(function(e) {
			e.preventDefault();
			const chapterId = $(this).attr("id");
			openChapter(chapterId);
		});
		$("#homeMenu").append($("<p>").append($link));
	});
}

function generateStoryBoard() {
	if ($("body")[0].id !== "storyBoard") {
		return;
	}
	const chapter = getCurrentChapter();
	$("#storyBoardTitle").text(chapter.storyBoardTitle);

	$("#goHome").click(function() {
		changeLocation("index.html");
	});

	const chapterKeys = Object.keys(presentation.chapters);
	if (chapterKeys.length === 1) {
		$("#goHome").hide();
	}

	let cols = "3";
	if (chapter.content.length > 25) {
		cols = "2";
	} else if (chapter.content.length > 16) {
		cols = "2/5";
	}
	$.each(chapter.content, function(index, slideId) {
		const $div = $("<div>", {class: `col-${cols} mb-4`});
		const $img = $("<img>", {src: "slides/media/thumbs/" + presentation.slides[slideId].thumbName});
		$img.click(function() {
			tryOpenSlide(slideId, "slides/");
		});
		$("#stories").append($div.append($img));
	});

}

function setNavigationEvents() {
	// Subscribe to change Slide and Sentiments
	const el = $("body.slide")[0];
	if (el) {
		var hammerSlide = Hammer(el);
		hammerSlide.get("swipe").set({ direction: Hammer.DIRECTION_ALL });

		hammerSlide.on("swipe swipeleft swiperight swipeup swipedown", function(ev) {
			switch(ev.direction) {
			case Hammer.DIRECTION_LEFT:
				if (!ev.target.classList.contains("skip-swipe")) {
					openNextSlide(el.id);
				}
				break;
			case Hammer.DIRECTION_RIGHT:
				if (!ev.target.classList.contains("skip-swipe")) {
					openPrevSlide(el.id);
				}
				break;
			case Hammer.DIRECTION_UP:
					setSentiment(el.id, true);
				break;
			case Hammer.DIRECTION_DOWN:
					setSentiment(el.id, false);
				break;
			}
		});
		  
		$(document).on("keyup", function(event) {
			const hammerDirection = navigationButtonCollection[event.keyCode];
			if (hammerDirection) {
				Hammer.assign(event, hammerDirection);
				hammerSlide.emit(hammerDirection.eventName, event);
			}
		  });

		$("#menuBtn").click(function() {
			const chapter = getCurrentChapter();
			if (chapter.storyBoardTitle) {
				changeLocation("../storyboard.html");
			} else {
				changeLocation("../index.html");
			}
		});
	}
}

function replaceMacros() {
	const el = $("body")[0];
	const values = presentation.slides[el.id]?.values || {};
	for (const [key, value] of Object.entries(values)) {
		$(`#${key}`).text(value);
	}

}

function changeLocation(href) {
	const endDate = new Date();
	const currentChapter = sessionStorage.getItem("chapterId");
	actions.shows.push({
		id: $("body")[0].id,
		chapter: currentChapter,
		start: startDate,
		end: endDate,
		duration: Math.floor(endDate.getTime() - startDate.getTime()) / 1000
	});
	publishMessageToApp();
	document.location.href = href;
}

function openChapter(chapterId) {
	if (!Object.prototype.hasOwnProperty.call(presentation.chapters, chapterId)) {
		alert(`The chapter "${chapterId}" is not configured in the structure`);
		return;
	}
	const chapter = presentation.chapters[chapterId];
	if (!chapter.content || !chapter.content.length) {
		alert(`Slides are not configured for chapter "${chapterId}"`);
		return;
	}
	setchapterToActions(chapterId, chapter.name);
	tryOpenSlide(chapter.content[0], "slides/");
}

function getCurrentChapter() {
	const chapterId = sessionStorage.getItem("chapterId");
	return presentation.chapters[chapterId];
}

function openNextSlide(currentSlideId) {
	const chapter = getCurrentChapter();
	let position = $.inArray(currentSlideId, chapter.content);
	if (++position >= chapter.content.length) {
		return;
	}
	tryOpenSlide(chapter.content[position]);
}

function openPrevSlide(currentSlideId) {
	const chapter = getCurrentChapter();
	let position = $.inArray(currentSlideId, chapter.content);
	if (--position < 0) {
		return;
	}
	tryOpenSlide(chapter.content[position]);
}

function openSlideLink(slideId) {
	const chapter = getCurrentChapter();
	let position = $.inArray(slideId, chapter.content);
	if (position == -1) {
		return;
	}
	tryOpenSlide(chapter.content[position]);
}

function tryOpenSlide(slideId, path) {
	path = path || "";
	if (!Object.prototype.hasOwnProperty.call(presentation.slides, slideId)) {
		alert(`The slide "${slideId}" is not configured in the structure`);
		return;
	}
	changeLocation(path + presentation.slides[slideId].template);
}

function setchapterToActions(chapterId, chapterName) {
	sessionStorage.setItem("chapterId", chapterId);
	const chapter = getCurrentChapter();
	if (!actions.chapters.find((o) => { return o["id"] === chapterId })) {
		actions.chapters.push({
			name: chapterName,
			id: chapterId
		});
		$.each(chapter.content, function(index, slideId) {
			actions.slides.push({
				name: presentation.slides[slideId].name,
				id: slideId,
				chapter: chapterId,
				like: 0
			});
		});
	}
	publishMessageToApp();
}

function setSentiment(slideId, value) {
	const chapterId = sessionStorage.getItem("chapterId");
	let obj = actions.slides.find((o) => { return o["id"] === slideId && o["chapter"] === chapterId});
	if (obj) {
		obj.like = value ? 1 : -1;
	}
	publishMessageToApp();
}

function publishMessageToApp() {
	const actionsObj = JSON.stringify(actions);
	sessionStorage.setItem("actions", actionsObj);

	try {
		webkit.messageHandlers.cordova_iab.postMessage(actionsObj);
	} catch {}
}

function subscribeTrackEvents() {
	document.querySelectorAll(".track-click").forEach(el => el.addEventListener("click", clickHandler));
	document.querySelectorAll(".track-change").forEach(el => el.addEventListener("change", changeHandler));
	document.querySelectorAll(".track-video").forEach(el => el.addEventListener("pause", videoHandler));
}

function clickHandler(e) {
	const marker = e.target.getAttribute('data-item-marker');
	if (!marker) {
		return;
	}

	actions.kpis.push({
		name: marker,
		value: "Click",
		time: new Date()
	});
	publishMessageToApp();
}

function changeHandler(e) {
	const marker = e.target.getAttribute("data-item-marker");
	if (!marker) {
		return;
	}

	const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;

	let obj = actions.kpis.find((o) => { return o["name"] === marker });
	if (obj) {
		obj.value = value;
		obj.time = new Date();
	} else {
		actions.kpis.push({
			name: marker,
			value: value,
			time: new Date()
		});
	}
	publishMessageToApp();
}

function videoHandler(e) {
	const marker = e.target.getAttribute("data-item-marker");
	if (!marker) {
		return;
	}

	let obj = actions.kpis.find((o) => { return o["name"] === marker });
	if (!obj) {
		actions.kpis.push({
			name: marker,
			value: e.target.currentTime.toFixed(),
			time: new Date()
		});
	} else if (e.target.currentTime > +obj.value) {
		obj.value = e.target.currentTime.toFixed();
		obj.time = new Date();
	}
	publishMessageToApp();
}

function handleFlexadinEvents() {
	$('div.flip-card').click(function(e) {
		e.preventDefault();
		let target = $(e.currentTarget);
		if (target.hasClass('flip')) {
			target.removeClass('flip');
		} else {
			target.addClass('flip');
		}
	});

	$('button[id$=overlay]').click(function(e) {
		e.preventDefault();
		let target = $(e.currentTarget), siblings = target.siblings('[id$=overlay]');
		siblings.click(function(e) {
			e.preventDefault();
			target.removeClass('open');
			siblings.removeClass('open');
		});
		if (target.hasClass('open')) {
			target.removeClass('open');
			siblings.removeClass('open');
		} else {
			target.addClass('open');
			siblings.addClass('open');
		}
	});

	$('button#hamburger').click(function(e) {
		e.preventDefault();
		let isOpened = $('nav#menu > ul').hasClass('open');
		if (isOpened) {
			$('nav#menu > ul').removeClass('open');
			$('div#blackout').hide();
		} else {
			$('nav#menu > ul').addClass('open');
			$('div#blackout').show();
		}
	});

	$('div#blackout').click(function(e) {
		e.preventDefault();
		$('nav#menu > ul').removeClass('open');
		$('div#blackout').hide();
	});

	$('a[data-slide-link], button[data-slide-link]').click(function(e) {
		e.preventDefault();
		let linkedSlideId = $(this).data('slide-link');
		openSlideLink(linkedSlideId);
	});

	$('a[data-external-link], button[data-external-link]').click(function(e) {
		e.preventDefault();
		let externalLink = $(this).data('external-link');
		cordova.InAppBrowser.open(externalLink, '_system');
	});
}