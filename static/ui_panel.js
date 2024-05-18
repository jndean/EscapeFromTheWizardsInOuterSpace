
var player_icons = {};
var actionBox = undefined;
var sigilBox = undefined;
var logBox = document.getElementById('log_box')

// Make right clicks do nothing
document.addEventListener(
    'contextmenu',
    e => {e.preventDefault();},
    false
);



function create_ui_components(game_obj) {

    // Player list
    let player_box = document.getElementById('player_list');
    for (let i = 0; i < game_obj.player_order.length; ++i) {
        let player_name = game_obj.player_order[i];
        let player = game_obj.players[player_name];
        let item = document.createElement('div');
        item.className = "textfield player-list-item";
        player_box.appendChild(item);

        let icon =  document.createElement('img');
        icon.draggable = false;
        icon.src = "static/symbols/" + ACADEMIC_NAMES[player.colour_id] + "_noise.png";
        icon.className = "player-list-icon";
        player_icons[player_name] = icon;
        
        let name_box = document.createElement('span');
        name_box.textContent = 'Adpt. ' + ACADEMIC_NAMES[player.colour_id] + ' ' +player.name;
        item.appendChild(icon);
        item.appendChild(name_box)
    }

    actionBox = new ActionBox(game_obj);
    sigilBox = new SigilBox();

    if (game_obj.players[player_name].alive) {
        board.create_player_token(
            game_obj.players[player_name].colour_id,
            game_obj.player_row,
            game_obj.player_col,
        );
    }
	updateUI(game_obj);
}


function SigilBox() {
    this.sigil_box_div = document.getElementById('sigil_box');
    this.desc_field = document.getElementById('sigils_text');
    this.no_sigil_msg_field = document.getElementById('no_sigils_msg');
    this.buttons = [];
    this.selection_callback = null;


    this.addSigil = function(sigil_name) {
        let desc = SIGIL_DESCRIPTIONS[SIGIL_NAMES.indexOf(sigil_name)];
        let symbol = sigil_name[0];

        let btn = document.createElement('img');
        btn.className = 'sigil button';
        btn.draggable = false;
        btn.src = "static/symbols/Sigil_" + symbol + ".png";
        btn.sigil_desc = desc;
        btn.sigil_name = sigil_name;
        btn.style.animation = 'grow-appear 2s ease-out';
        this.buttons.push(btn);
        this.sigil_box_div.prepend(btn);
        this.showOrHideNoSigilMessage();
        
        btn.onmouseover = e => {
            this.desc_field.innerHTML = desc;
            this.desc_field.style.display = '';
            // btn.style.animation = 'vibrate 50ms linear infinite forwards';
        };
        btn.onmouseleave = e => {
            this.desc_field.textContent = '';
            this.desc_field.style.display = 'none';
            // btn.style.animation = '';
        };
        btn.onmousedown = e => {
            if (this.selection_callback == null) 
                return;
            let selection_callback = this.selection_callback;
            this.selection_callback = null;
            selection_callback({
                name: btn.sigil_name,
                idx: this.buttons.indexOf(btn)
            });
        }
    }
    
    this.removeSigil = function(i) {
        let btn = this.buttons[i];
        this.buttons.splice(i, 1);
        btn.style.animation = 'shrink-fade 1s ease-in-out';
        setTimeout(() => {
            destroy(btn);
            this.showOrHideNoSigilMessage();
        }, 900);
    }

    this.assertSigilList = function(sigils) {
        let equal = sigils.length == this.buttons.length;
        for (let i = 0; i < Math.min(sigils.length, this.buttons.length); ++i) {
            equal &= sigils[i] == this.buttons[i].sigil_name;
        }
        if (equal) return;

        // Sigil list is different, so change it.
        while(this.buttons.length) {
            this.buttons[0].style.display = 'none';
            this.removeSigil(0);
        }
        sigils.forEach(x => {this.addSigil(x);});
    }

    this.showOrHideNoSigilMessage = function() {
        if (this.buttons.length == 0) {
            this.no_sigil_msg_field.style.transition = 'opacity 1s';
            this.no_sigil_msg_field.style.opacity = 1;
        } else {
            this.no_sigil_msg_field.style.transition = 'opacity 0s';
            this.no_sigil_msg_field.style.opacity = 0;
        }
    }

    this.begin_selection = function(selection_callback) {
        this.selection_callback = selection_callback;
    }

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
    sigilBox.assertSigilList(game_state.sigils);

    // Log
    logBox.innerHTML = game_state.log;

    // History tokens
    for (const [name_, player] of Object.entries(game_state.players)) {
        board.display_player_history(player);
    }

    // Player Token
    if (game_state.players[player_name].alive) {
        board.move_player_token(game_state.player_row, game_state.player_col);
    } else if (board.player_token !== undefined) {
        destroy(board.player_token);
        board.player_token = undefined;
    }
}


// -------------------- Action Box --------------------- //


function ActionBox(game_state) {
    this.game_state = game_state;

    // this.available_actions = new Set();
    this.act_names = ['move', 'decoy', 'attack', 'sigil', 'discard', 'finish'];
    this.btn_names = this.act_names.concat(['confirm', 'cancel']);
    this.btn = {};
    for (let i = 0; i < this.btn_names.length; ++i) {
        let name = this.btn_names[i];
        this.btn[name] = document.getElementById('act_btn_' + name);
        this.btn[name].onclick = ev => {actionBtnHandlers[name](ev)};
    }

    this.textbox = document.getElementById("action_text");

    this.possible_states = [
        'notmyturn',
        'choose_action',
        'choose_move_hex',
        'choose_move_hex_confirm',
        'choose_decoy_hex',
        'choose_decoy_hex_confirm',
        'choose_attack_hex',
        'choose_attack_hex_confirm',
        'choose_sigil',
        'choose_sigil_confirm',
        'choose_detection_hex',
        'choose_detection_hex_confirm',
        'choose_discard',
    ];

    this.state_msgs = {
        notmyturn: '<font color="#777" size=5>It is not your turn...</font>',
        choose_action: 'Choose an action...',
        choose_move_hex: 'Choose where to go',
        choose_move_hex_confirm: 'Confirm move',
        choose_decoy_hex: 'Choose any hex to disturb',
        choose_decoy_hex_confirm: 'Confirm disturbance',
        choose_attack_hex: 'Choose a hex to attack',
        choose_attack_hex_confirm: 'Confirm attack',
        choose_sigil: '',
        choose_sigil_confirm: '',
        choose_detection_hex: '',
        choose_detection_hex_confirm: '',
        choose_discard: 'Choose a sigil to discard',
    };

    this.transitionUpdate = function(message, duration, new_state_str) {
        this.textbox.innerHTML = message;
        for (let i = 0; i < this.btn_names.length; ++i) {
            let name = this.btn_names[i];
            this.btn[name].style.display = 'none';
        }
        setTimeout(() => {this.update(new_state_str);}, duration);
    }

    this.update = function(new_state_str=null) {
        if (new_state_str != null) this.state = new_state_str;

        this.textbox.innerHTML = this.state_msgs[this.state];

        let visible_buttons = new Set();
        switch (this.state) {
            case 'notmyturn':
                break;
                
            case 'choose_action':
                if (this.game_state.sigils.length > 0 && !this.game_state.is_warlock) {
                    visible_buttons.add('sigil');
                }
                if (!this.game_state.moved_this_turn) {
                    visible_buttons.add('move');
                    if (this.game_state.is_warlock) {
                        visible_buttons.add('attack');
                    }
                } else {
                    if (this.game_state.sigils.length > MAX_SIGILS) {
                        visible_buttons.add('discard');
                    } else if (this.game_state.decoy_choice_required) {
                        visible_buttons.add('decoy');
                    } else {
                        visible_buttons.add('finish');
                    }
                }
                break;

            case 'choose_attack_hex':
            case 'choose_move_hex':
            case 'choose_decoy_hex':
                visible_buttons.add('cancel');
                break;

            case 'choose_attack_hex_confirm':
            case 'choose_move_hex_confirm':
            case 'choose_decoy_hex_confirm':
                visible_buttons.add('confirm');
                visible_buttons.add('cancel');
                break;

            case 'choose_discard':
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
    // Skip excess queued messages
    while(banner_msg_queue.length > 3) banner_msg_queue.pop();
    let [msg, duration, font_size] = banner_msg_queue.pop();
    
    banner_div.innerHTML = msg;
    banner_div.style.fontSize = font_size + 'px';
    banner_div.style.opacity = 0.9;
    
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
