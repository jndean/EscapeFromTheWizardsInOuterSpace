
var sigil_buttons = {};
var player_icons = {};
var actionBox = undefined;



function create_ui_components(game_state) {

    // TMP
    // game.player_order = ['Josef', 'Katharine', 'Lloyd', 'Sean', 'Rebecca', 'Lucy'];
    // for (let i = 0; i < game.player_order.length; ++i) {
    //     let name = game.player_order[i];
    //     game.players[name] = new Player(name, i);
    // }
    // shuffle(game.player_order);
    // for (let i = 0; i < 3; ++i) {
    //     game.sigils.add(SIGIL_NAMES[i]);
    // }


    // Player list
    let player_box = document.getElementById('player_list');
    for (let i = 0; i < game_state.player_order.length; ++i) {
        let player_name = game_state.player_order[i];
        let player = game_state.players[player_name];
        let item = document.createElement('div');
        item.className = "textfield player-list-item";
        player_box.appendChild(item);

        let icon =  document.createElement('img');
        icon.draggable = false;
        icon.src = "static/symbols/" + ACADEMIC_NAMES[player.colour_id] + "_blank.png";
        icon.className = "player-list-icon";
        player_icons[player_name] = icon;
        
        let name_box = document.createElement('span');
        name_box.textContent = 'Adpt. ' + ACADEMIC_NAMES[player.colour_id] + ' ' +player.name;
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
            game_state.sigils.delete(name);
            updateUI();
        }
    }

    board.create_player_token(
        game_state.players[player_name].colour_id,
        game_state.player_row,
        game_state.player_col,
    );

}


function updateUI(game_state) {

    // Player List
    for (let i = 0; i < game_state.player_order.length; ++i) {
        let player_name = game_state.player_order[i];
        if (game_state.current_player == i) {
            player_icons[player_name].className = "active-player-list-icon";
        } else {
            player_icons[player_name].className = "player-list-icon";
        }
    }

    // Sigils
    SIGIL_NAMES.forEach((name) => {
        let btn = sigil_buttons[name];
        if (game_state.sigils.has(name)) {
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
    if (game_state.sigils.size) {
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

    // Player Token
    board.move_player_token(game_state.player_row, game_state.player_col);
}


// -------------------- Action Box --------------------- //


function ActionBox(game_state) {
    this.game_state = game_state;

    // this.available_actions = new Set();
    this.act_names = ['move', 'attack', 'sigil', 'finish'];
    this.btn_names = this.act_names.concat(['confirm', 'cancel']);
    this.btn = {};
    for (let i = 0; i < this.btn_names.length; ++i) {
        let name = this.btn_names[i];
        this.btn[name] = document.getElementById('act_btn_' + name);
        this.btn[name].onclick = (ev) => {actionBtnHandlers[name](ev)};
    }

    this.textbox = document.getElementById("action_text");

    this.possible_states = [
        'notmyturn',
        'choose_action',
        'choose_move_hex',
        'choose_move_hex_confirm',
        'choose_sigil',
        'choose_sigil_confirm',
        'attack_confirm', // Say, 'This will end your turn'
        'choose_detection_hex',
        'choose_detection_hex_confirm',
    ];

    this.update = function(new_state_str=null) {
        if (new_state_str != null) this.state = new_state_str;

        let visible_buttons = new Set();
        switch (this.state) {
            case 'notmyturn':
                this.textbox.innerHTML = '<font color="#777" size=5>It is not your turn...</font>';
                break;
                
            case 'choose_action':
                this.textbox.innerHTML = 'Choose an action...';
                if (!this.game_state.moved_this_turn) {
                    visible_buttons.add('move');
                } else {
                    visible_buttons.add('finish');
                    if (this.game_state.is_warlock) {
                        visible_buttons.add('attack');
                    } else if (this.game_state.sigils.length) {
                        visible_buttons.add('sigil');
                    }
                }
                break;

            case 'choose_move_hex':            
                this.textbox.innerHTML = 'Choose a hex';
                visible_buttons.add('cancel');
                break;

            case 'choose_move_hex_confirm':            
                this.textbox.innerHTML = 'Choose a hex';
                visible_buttons.add('confirm');
                visible_buttons.add('cancel');
                break;

            default:
                alert('Invalid ActionBox state: ' + this.state);
                break;
        }

        for (let i = 0; i < this.btn_names.length; ++i) {
            let name = this.btn_names[i];
            this.btn[name].style.display = visible_buttons.has(name) ? '' : 'none';
        }
    }

    this.update('notmyturn');
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
