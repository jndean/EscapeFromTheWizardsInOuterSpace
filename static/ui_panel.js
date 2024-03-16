
var sigil_buttons = {};

create_ui_components();


function create_ui_components() {

    let sigil_box = document.getElementById('sigil_box');
    let sigil_desc_field = document.getElementById('sigils_text');

    for (let i = 0; i < SIGIL_NAMES.length; ++i) {
        let name = SIGIL_NAMES[i];
        let desc = SIGIL_DESCRIPTIONS[i];
        let symbol = name[0];
        let btn = document.createElement('img');
        btn.className = 'button';
        btn.draggable = false;
        btn.src = "static/symbols/sigil_" + symbol + ".png";
        btn.desc = desc;
        sigil_buttons[name] = btn;
        sigil_box.prepend(btn);

        btn.onmouseover = function(e) {
            sigil_desc_field.innerHTML = desc;
        };
        btn.onmouseleave = function(e) {
            sigil_desc_field.textContent = '';
        };
    }

}