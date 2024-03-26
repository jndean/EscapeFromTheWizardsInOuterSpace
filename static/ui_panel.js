
var sigil_buttons = {};
var player_icons = {};

create_ui_components();



function create_ui_components() {

    // TMP
    game.player_order = ['Josef', 'Katharine', 'Lloyd', 'Sean', 'Rebecca', 'Lucy'];
    for (let i = 0; i < game.player_order.length; ++i) {
        let name = game.player_order[i];
        game.players[name] = new Player(name, i);
    }
    shuffle(game.player_order);
    for (let i = 0; i < 3; ++i) {
        game.sigils.add(SIGIL_NAMES[i]);
    }


    // Player list
    let player_box = document.getElementById('player_list');
    for (let i = 0; i < game.player_order.length; ++i) {
        let player_name = game.player_order[i];
        let player = game.players[player_name];
        let item = document.createElement('div');
        item.className = "textfield player-list-item";
        player_box.appendChild(item);

        let icon =  document.createElement('img');
        icon.draggable = false;
        icon.src = "static/symbols/" + ACADEMIC_NAMES[player.colour_id] + "_blank.png";
        icon.className = "player-list-icon";
        player_icons[player_name] = icon;
        
        let name_box = document.createElement('span');
        name_box.textContent = 'Adpt. ' + ACADEMIC_NAMES[player.colour_id] + ' ' +player.name;;
        item.appendChild(icon);
        item.appendChild(name_box)
    }

    
    // Sigils
    let sigil_box = document.getElementById('sigil_box');
    let sigil_desc_field = document.getElementById('sigils_text');
    
    for (let i = 0; i < SIGIL_NAMES.length; ++i) {
        let name = SIGIL_NAMES[i];
        let desc = SIGIL_DESCRIPTIONS[i];
        let symbol = name[0];
        let btn = document.createElement('img');
        btn.className = 'sigil button';
        btn.draggable = false;
        btn.src = "static/symbols/Sigil_" + symbol + ".png";
        btn.sigil_desc = desc;
        btn.sigil_name = name;
        btn.style.display = 'none';
        sigil_buttons[name] = btn;
        sigil_box.prepend(btn);
        
        btn.onmouseover = function(e) {
            sigil_desc_field.innerHTML = desc;
        };
        btn.onmouseleave = function(e) {
            sigil_desc_field.textContent = '';
        };
        btn.onmousedown = function(e) {  // DELETEME PLS!
            game.sigils.delete(name);
            updateUIpanel();
        }
    }
    
    updateUIpanel();
}


function updateUIpanel() {

    // Player List
    for (let i = 0; i < game.player_order.length; ++i) {
        let player_name = game.player_order[i];
        if (game.current_player == i) {
            player_icons[player_name].className = "active-player-list-icon";
        } else {
            player_icons[player_name].className = "player-list-icon";
        }
    }

    // Sigils
    SIGIL_NAMES.forEach((name) => {
        let btn = sigil_buttons[name];
        if (game.sigils.has(name)) {
            if (btn.style.display == 'none') {
                btn.style.display = '';
                btn.style.animation = 'grow-appear 0.8s ease-in-out';
            }
        } else if (btn.style.display == '') {
            btn.style.animation = 'shrink-fade 0.8s ease-in-out';
            setTimeout(() => {
                btn.style.display = 'none';
            }, 800);
        }
    });
    let no_sigil_msg_field = document.getElementById('no_sigils_msg');
    if (game.sigils.size) {
        no_sigil_msg_field.textContent = '';
        no_sigil_msg_field.style.opacity = 0;
    } else {
        setTimeout(() => {
            no_sigil_msg_field.style.transitionProperty = 'opacity';
            no_sigil_msg_field.style.transitionDuration = '1s';
            no_sigil_msg_field.style.opacity = 1;
            no_sigil_msg_field.innerHTML = 'You have no Sigils. <br>Search dangerous spaces <br> to find more...';
        }, 800);
    }
}


// -----------  Message Banner -------- //

var banner_div = document.getElementById("message_banner");
var banner_msg_queue = [];

function displayBannerMessage(msg, duration, font_size=60) {
    banner_msg_queue.unshift([msg, duration, font_size]);
    runBannerMessageDispatcher();
}

var banner_msg_is_active = false;
function runBannerMessageDispatcher() {
    if (banner_msg_is_active || banner_msg_queue.length == 0) {
        return;
    }
    banner_msg_is_active = true;
    let [msg, duration, font_size] = banner_msg_queue.pop();
    
    banner_div.innerHTML = msg;
    banner_div.style.fontSize = font_size + 'px';
    banner_div.style.opacity = 0.8;
    
    const opacity_transition_time = 2000; // Set in style.css
    let fade_start = Math.max(
        duration - opacity_transition_time,
        duration / 2
    );
    setTimeout(() => {
        banner_div.style.opacity = 0;
    }, fade_start);

    setTimeout(() => {
        banner_msg_is_active = false;
        runBannerMessageDispatcher();
    }, duration);
};

// -------------------------------------- //