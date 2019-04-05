var PioneerDDJRB = function() {};

/*
    Find the latest code at https://github.com/dg3nec/mixxx
   
    
    This mapping for the Pioneer DDJ-RB was made by DG3NEC, Michael Stahl
    Basing on DDj-SB for Mixxx 2.0 Joan Ardiaca Jové (joan.ardiaca@gmail.com),
    basing on the work of wingcom (wwingcomm@gmail.com, https://github.com/wingcom/Mixxx-Pioneer-DDJ-SB).
    which in turn was based on the work of Hilton Rudham (https://github.com/hrudham/Mixxx-Pioneer-DDJ-SR).
    Just as wingcom's and Rudham's work, this mapping is pusblished under the MIT license.
  
    TODO:
    - eliminate code for "virtual 4 deck mode DDJ-SB"
    - Softtakeover: Rate, Crossover
 
*/


///////////////////////////////////////////////////////////////
//                       USER OPTIONS                        //
///////////////////////////////////////////////////////////////

// If true the sync button blinks with the beat, if false led is lit when sync is enabled.
PioneerDDJRB.blinkingSync = false;

// If true, the vinyl button activates slip. Vinyl mode is then activated by using shift.
// Allows toggling slip faster, but is counterintuitive.
PioneerDDJRB.invertVinylSlipButton = false;

// Sets the jogwheels sensivity. 1 is default, 2 is twice as sensitive, 0.5 is half as sensitive.
PioneerDDJRB.jogwheelSensivity = 1.0;

// Sets how much more sensitive the jogwheels get when holding shift.
// Set to 1 to disable jogwheel sensitivity increase when holding shift.
PioneerDDJRB.jogwheelShiftMultiplier = 20;

// Time per step (in ms) for pitch speed fade to normal
PioneerDDJRB.speedRateToNormalTime = 200;

// If true Level-Meter shows VU-Master left & right. If false shows level of channel: 1/3  2/4 (depending active deck)
PioneerDDJRB.showVumeterMaster = false;

// Cut's Level-Meter low and expand upper. Examples:
// 0.25 -> only signals greater 25%, expanded to full range
// 0.5 -> only signals greater 50%, expanded to full range
PioneerDDJRB.cutVumeter = 0.25;

// If true VU-Level twinkle if AutoDJ is ON.
PioneerDDJRB.twinkleVumeterAutodjOn = true;

// If true, by release browser knob jump forward to "position". 
PioneerDDJRB.jumpPreviewEnabled = true;
PioneerDDJRB.jumpPreviewPosition = 0.5;


///////////////////////////////////////////////////////////////
//               INIT, SHUTDOWN & GLOBAL HELPER              //
///////////////////////////////////////////////////////////////
PioneerDDJRB.longButtonPress = false;
PioneerDDJRB.speedRateToNormalTimer = new Array(4);

PioneerDDJRB.init = function(id) {
    PioneerDDJRB.scratchSettings = {
        'alpha': 1.0 / 8,
        'beta': 1.0 / 8 / 32,
        'jogResolution': 720,
        'vinylSpeed': 33 + 1 / 3,
        'safeScratchTimeout': 20
    };

    PioneerDDJRB.channelGroups = {
        '[Channel1]': 0x00,
        '[Channel2]': 0x01,
    };

    PioneerDDJRB.samplerGroups = {
        '[Sampler1]': 0x00,
        '[Sampler2]': 0x01,
        '[Sampler3]': 0x02,
        '[Sampler4]': 0x03
    };

    PioneerDDJRB.fxGroups = {
        '[EffectRack1_EffectUnit1]': 0x00,
        '[EffectRack1_EffectUnit2]': 0x01
    };

    PioneerDDJRB.fxControls = {
        'group_[Channel1]_enable': 0x00,
        'group_[Headphone]_enable': 0x01,
        'group_[Master]_enable': 0x01,
        'group_[Channel2]_enable': 0x02,
    };

    PioneerDDJRB.shiftPressed = false;

    PioneerDDJRB.chFaderStart = [
        null,
        null
    ];

    PioneerDDJRB.fxButtonPressed = [
        [false, false, false],
        [false, false, false]
    ];

    // used for soft takeover workaround
    PioneerDDJRB.fxParamsActiveValues = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
    ];

    PioneerDDJRB.scratchMode = [false, false, false, false];

    PioneerDDJRB.ledGroups = {
        'hotCue': 0x00,
        'autoLoop': 0x10,
        'manualLoop': 0x20,
        'sampler': 0x30
    };

    PioneerDDJRB.nonPadLeds = {
        'headphoneCue': 0x54,
        'shiftHeadphoneCue': 0x68,
        'cue': 0x0C,
        'shiftCue': 0x48,
        'keyLock': 0x1A,
        'shiftKeyLock': 0x60,
        'play': 0x0B,
        'shiftPlay': 0x47,
        'vinyl': 0x17,
        'shiftVinyl': 0x4E,
        'sync': 0x58,
        'shiftSync': 0x5C
    };

    PioneerDDJRB.valueVuMeter = {
        '[Channel1]_current': 0,
        '[Channel2]_current': 0,
        '[Channel1]_enabled': 1,
        '[Channel2]_enabled': 1,

    };

    PioneerDDJRB.loopIntervals = [1, 2, 4, 8, 16, 32, 64];

    PioneerDDJRB.looprollIntervals = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4, 8];

    PioneerDDJRB.setAllSoftTakeover(false);
    PioneerDDJRB.bindNonDeckControlConnections(false);
    PioneerDDJRB.initDeck('[Channel1]');
    PioneerDDJRB.initDeck('[Channel2]');

    if (PioneerDDJRB.twinkleVumeterAutodjOn) {
        PioneerDDJRB.vu_meter_timer = engine.beginTimer(100, "PioneerDDJRB.vuMeterTwinkle()");
    }
};

PioneerDDJRB.shutdown = function() {
    PioneerDDJRB.bindAllControlConnections(true);
    PioneerDDJRB.setAllSoftTakeover(true);
};

PioneerDDJRB.longButtonPressWait = function() {
    engine.stopTimer(PioneerDDJRB.longButtonPressTimer);
    PioneerDDJRB.longButtonPress = true;
};

PioneerDDJRB.speedRateToNormal = function(group, deck) {
    var speed = engine.getValue(group, 'rate');
    if (speed > 0) {
        engine.setValue(group, 'rate_perm_down_small', true);
        if (engine.getValue(group, 'rate') <= 0) {
            engine.stopTimer(PioneerDDJRB.speedRateToNormalTimer[deck]);
            engine.setValue(group, 'rate', 0);
        }
    } else if (speed < 0) {
        engine.setValue(group, 'rate_perm_up_small', true);
        if (engine.getValue(group, 'rate') >= 0) {
            engine.stopTimer(PioneerDDJRB.speedRateToNormalTimer[deck]);
            engine.setValue(group, 'rate', 0);
        }
    }
};


///////////////////////////////////////////////////////////////
//                      VU - Meter                           //
///////////////////////////////////////////////////////////////

PioneerDDJRB.blinkAutodjState = 0; // new for DDJ-RB

PioneerDDJRB.vuMeterTwinkle = function() {
    if (engine.getValue("[AutoDJ]", "enabled")) {
        PioneerDDJRB.blinkAutodjState = PioneerDDJRB.blinkAutodjState + 1;
        if (PioneerDDJRB.blinkAutodjState > 3) {
            PioneerDDJRB.blinkAutodjState = 0;
        }
        if (PioneerDDJRB.blinkAutodjState === 0) {
            PioneerDDJRB.valueVuMeter['[Channel1]_enabled'] = 0;
            PioneerDDJRB.valueVuMeter['[Channel2]_enabled'] = 0;
        }
        if (PioneerDDJRB.blinkAutodjState === 1) {
            PioneerDDJRB.valueVuMeter['[Channel1]_enabled'] = 1;
            PioneerDDJRB.valueVuMeter['[Channel2]_enabled'] = 0;
        }
        if (PioneerDDJRB.blinkAutodjState === 2) {
            PioneerDDJRB.valueVuMeter['[Channel1]_enabled'] = 1;
            PioneerDDJRB.valueVuMeter['[Channel2]_enabled'] = 1;
        }
        if (PioneerDDJRB.blinkAutodjState === 3) {
            PioneerDDJRB.valueVuMeter['[Channel1]_enabled'] = 0;
            PioneerDDJRB.valueVuMeter['[Channel2]_enabled'] = 1;
        }
    } else {
        PioneerDDJRB.valueVuMeter['[Channel1]_enabled'] = 1;
        PioneerDDJRB.valueVuMeter['[Channel2]_enabled'] = 1;
    }
};


///////////////////////////////////////////////////////////////
//                        AutoDJ                             //
///////////////////////////////////////////////////////////////

PioneerDDJRB.autodjSkipNext = function(channel, control, value, status, group) {
    if (value === 0) {
        return;
    }
    if (engine.getValue("[AutoDJ]", "enabled")) {
        engine.setValue("[AutoDJ]", "skip_next", true);
    }
};

PioneerDDJRB.autodjToggle = function(channel, control, value, status, group) {
    if (value === 0) {
        return;
    }
    if (engine.getValue("[AutoDJ]", "enabled")) {
        engine.setValue("[AutoDJ]", "enabled", false);
    } else {
        engine.setValue("[AutoDJ]", "enabled", true);
    }
};


///////////////////////////////////////////////////////////////
//                      CONTROL BINDING                      //
///////////////////////////////////////////////////////////////

PioneerDDJRB.bindSamplerControlConnections = function(samplerGroup, isUnbinding) {
    engine.connectControl(samplerGroup, 'duration', 'PioneerDDJRB.samplerLeds', isUnbinding);
};

PioneerDDJRB.bindDeckControlConnections = function(channelGroup, isUnbinding) {
    var i,
        index,
        fxUnitIndex = 1,
        controlsToFunctions = {
            'play': 'PioneerDDJRB.playLeds',
            'pfl': 'PioneerDDJRB.headphoneCueLed',
            'keylock': 'PioneerDDJRB.keyLockLed',
            'slip_enabled': 'PioneerDDJRB.slipLed',
            'quantize': 'PioneerDDJRB.quantizeLed',
            'loop_in': 'PioneerDDJRB.loopInLed',
            'loop_out': 'PioneerDDJRB.loopOutLed',
            'filterLowKill': 'PioneerDDJRB.lowKillLed',
            'filterMidKill': 'PioneerDDJRB.midKillLed',
            'filterHighKill': 'PioneerDDJRB.highKillLed',
            'mute': 'PioneerDDJRB.muteLed',
            'loop_enabled': 'PioneerDDJRB.loopExitLed',
            'loop_double': 'PioneerDDJRB.loopDoubleLed',
            'loop_halve': 'PioneerDDJRB.loopHalveLed'
        };

    if (PioneerDDJRB.blinkingSync) {
        controlsToFunctions.beat_active = 'PioneerDDJRB.syncLed';
    } else {
        controlsToFunctions.sync_enabled = 'PioneerDDJRB.syncLed';
    }

    for (i = 1; i <= 8; i++) {
        controlsToFunctions['hotcue_' + i + '_enabled'] = 'PioneerDDJRB.hotCueLeds';
    }

    for (index in PioneerDDJRB.loopIntervals) {
        controlsToFunctions['beatloop_' + PioneerDDJRB.loopIntervals[index] + '_enabled'] = 'PioneerDDJRB.beatloopLeds';
    }

    for (index in PioneerDDJRB.looprollIntervals) {
        controlsToFunctions['beatlooproll_' + PioneerDDJRB.looprollIntervals[index] + '_activate'] = 'PioneerDDJRB.beatlooprollLeds';
    }

    script.bindConnections(channelGroup, controlsToFunctions, isUnbinding);

    for (fxUnitIndex = 1; fxUnitIndex <= 2; fxUnitIndex++) {
        engine.connectControl('[EffectRack1_EffectUnit' + fxUnitIndex + ']', 'group_' + channelGroup + '_enable', 'PioneerDDJRB.fxLeds', isUnbinding);
        if (!isUnbinding) {
            engine.trigger('[EffectRack1_EffectUnit' + fxUnitIndex + ']', 'group_' + channelGroup + '_enable');
        }
    }
};

PioneerDDJRB.bindNonDeckControlConnections = function(isUnbinding) {
    var samplerIndex,
        fxUnitIndex;

    for (samplerIndex = 1; samplerIndex <= 4; samplerIndex++) {
        PioneerDDJRB.bindSamplerControlConnections('[Sampler' + samplerIndex + ']', isUnbinding);
    }

    for (fxUnitIndex = 1; fxUnitIndex <= 2; fxUnitIndex++) {
        engine.connectControl('[EffectRack1_EffectUnit' + fxUnitIndex + ']', 'group_[Headphone]_enable', 'PioneerDDJRB.fxLeds', isUnbinding);
    }
    for (fxUnitIndex = 1; fxUnitIndex <= 2; fxUnitIndex++) {
        engine.connectControl('[EffectRack1_EffectUnit' + fxUnitIndex + ']', 'group_[Master]_enable', 'PioneerDDJRB.fxLeds', isUnbinding);
    }

    if (PioneerDDJRB.showVumeterMaster) {
        engine.connectControl('[Master]', 'VuMeterL', 'PioneerDDJRB.VuMeterLeds', isUnbinding);
        engine.connectControl('[Master]', 'VuMeterR', 'PioneerDDJRB.VuMeterLeds', isUnbinding);
    } else {
        engine.connectControl('[Channel1]', 'VuMeter', 'PioneerDDJRB.VuMeterLeds', isUnbinding);
        engine.connectControl('[Channel2]', 'VuMeter', 'PioneerDDJRB.VuMeterLeds', isUnbinding);
    }
};

PioneerDDJRB.bindAllControlConnections = function(isUnbinding) {
    var samplerIndex,
        fxUnitIndex,
        channelIndex;

    for (samplerIndex = 1; samplerIndex <= 4; samplerIndex++) {
        PioneerDDJRB.bindSamplerControlConnections('[Sampler' + samplerIndex + ']', isUnbinding);
    }

    for (fxUnitIndex = 1; fxUnitIndex <= 2; fxUnitIndex++) {
        engine.connectControl('[EffectRack1_EffectUnit' + fxUnitIndex + ']', 'group_[Headphone]_enable', 'PioneerDDJRB.fxLeds', isUnbinding);
    }

    for (channelIndex = 1; channelIndex <= 2; channelIndex++) {
        PioneerDDJRB.bindDeckControlConnections('[Channel' + channelIndex + ']', isUnbinding);
    }
};

PioneerDDJRB.setDeckSoftTakeover = function(channel, isUnbinding) {
    engine.softTakeover(channel, "volume", !isUnbinding);
    engine.softTakeover(channel, "rate", !isUnbinding);
    engine.softTakeover(channel, "pregain", !isUnbinding);
    engine.softTakeover(channel, "filterHigh", !isUnbinding);
    engine.softTakeover(channel, "filterMid", !isUnbinding);
    engine.softTakeover(channel, "filterLow", !isUnbinding);
    engine.softTakeover("[QuickEffectRack1_" + channel + "]", "super1", !isUnbinding);
};

PioneerDDJRB.setAllSoftTakeover = function(isUnbinding) {
    var channelIndex;
    for (channelIndex = 1; channelIndex <= 2; channelIndex++) {
        PioneerDDJRB.setDeckSoftTakeover('[Channel' + channelIndex + ']', isUnbinding);
    }
};


///////////////////////////////////////////////////////////////
//                       DECK SWITCHING                      //
///////////////////////////////////////////////////////////////

PioneerDDJRB.deckSwitchTable = {
    '[Channel1]': '[Channel1]',
    '[Channel2]': '[Channel2]',

};

PioneerDDJRB.deckShiftSwitchTable = {
    '[Channel1]': '[Channel3]',
    '[Channel2]': '[Channel4]',
    '[Channel3]': '[Channel1]',
    '[Channel4]': '[Channel2]'
};

PioneerDDJRB.initDeck = function(group) {
    PioneerDDJRB.bindDeckControlConnections(group, false);
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.shiftKeyLock, PioneerDDJRB.channelGroups[group] > 1);
    PioneerDDJRB.triggerVinylLed(PioneerDDJRB.channelGroups[group]);
};


///////////////////////////////////////////////////////////////
//            HIGH RESOLUTION MIDI INPUT HANDLERS            //
///////////////////////////////////////////////////////////////

PioneerDDJRB.highResMSB = {
    '[Channel1]': {},
    '[Channel2]': {},
};

PioneerDDJRB.tempoSliderMSB = function(channel, control, value, status, group) {
    PioneerDDJRB.highResMSB[group].tempoSlider = value;
};

PioneerDDJRB.tempoSliderLSB = function(channel, control, value, status, group) {
    var fullValue = (PioneerDDJRB.highResMSB[group].tempoSlider << 7) + value;
    engine.setValue(
        PioneerDDJRB.deckSwitchTable[group],
        'rate',
        ((0x4000 - fullValue) - 0x2000) / 0x2000
    );
};

PioneerDDJRB.gainKnobMSB = function(channel, control, value, status, group) {
    PioneerDDJRB.highResMSB[group].gainKnob = value;
};

PioneerDDJRB.gainKnobLSB = function(channel, control, value, status, group) {
    var fullValue = (PioneerDDJRB.highResMSB[group].gainKnob << 7) + value;
    engine.setValue(
        PioneerDDJRB.deckSwitchTable[group],
        'pregain',
        script.absoluteNonLin(fullValue, 0.0, 1.0, 4.0, 0, 0x3FFF)
    );
};

PioneerDDJRB.filterHighKnobMSB = function(channel, control, value, status, group) {
    PioneerDDJRB.highResMSB[group].filterHigh = value;
};

PioneerDDJRB.filterHighKnobLSB = function(channel, control, value, status, group) {
    var fullValue = (PioneerDDJRB.highResMSB[group].filterHigh << 7) + value;
    engine.setValue(
        group,
        'filterHigh',
        script.absoluteNonLin(fullValue, 0.0, 1.0, 4.0, 0, 0x3FFF)
    );
};

PioneerDDJRB.filterMidKnobMSB = function(channel, control, value, status, group) {
    PioneerDDJRB.highResMSB[group].filterMid = value;
};

PioneerDDJRB.filterMidKnobLSB = function(channel, control, value, status, group) {
    var fullValue = (PioneerDDJRB.highResMSB[group].filterMid << 7) + value;
    engine.setValue(
        group,
        'filterMid',
        script.absoluteNonLin(fullValue, 0.0, 1.0, 4.0, 0, 0x3FFF));
};

PioneerDDJRB.filterLowKnobMSB = function(channel, control, value, status, group) {
    PioneerDDJRB.highResMSB[group].filterLow = value;
};

PioneerDDJRB.filterLowKnobLSB = function(channel, control, value, status, group) {
    var fullValue = (PioneerDDJRB.highResMSB[group].filterLow << 7) + value;
    engine.setValue(
        group,
        'filterLow',
        script.absoluteNonLin(fullValue, 0.0, 1.0, 4.0, 0, 0x3FFF)
    );
};

PioneerDDJRB.deckFaderMSB = function(channel, control, value, status, group) {
    PioneerDDJRB.highResMSB[group].deckFader = value;
};

PioneerDDJRB.deckFaderLSB = function(channel, control, value, status, group) {
    var fullValue = (PioneerDDJRB.highResMSB[group].deckFader << 7) + value;

    if (PioneerDDJRB.shiftPressed &&
        engine.getValue(group, 'volume') === 0 &&
        fullValue !== 0 &&
        engine.getValue(group, 'play') === 0
    ) {
        PioneerDDJRB.chFaderStart[channel] = engine.getValue(group, 'playposition');
        engine.setValue(group, 'play', 1);
    } else if (
        PioneerDDJRB.shiftPressed &&
        engine.getValue(group, 'volume') !== 0 &&
        fullValue === 0 &&
        engine.getValue(group, 'play') === 1 &&
        PioneerDDJRB.chFaderStart[channel] !== null
    ) {
        engine.setValue(group, 'play', 0);
        engine.setValue(group, 'playposition', PioneerDDJRB.chFaderStart[channel]);
        PioneerDDJRB.chFaderStart[channel] = null;
    }
    engine.setValue(group, 'volume', fullValue / 0x3FFF);
};

PioneerDDJRB.filterKnobMSB = function(channel, control, value, status, group) {
    PioneerDDJRB.highResMSB[group].filterKnob = value;
};

PioneerDDJRB.filterKnobLSB = function(channel, control, value, status, group) {
    var fullValue = (PioneerDDJRB.highResMSB[group].filterKnob << 7) + value;
    engine.setValue('[QuickEffectRack1_' + group + ']', 'super1', fullValue / 0x3FFF);
};


///////////////////////////////////////////////////////////////
//           SINGLE MESSAGE MIDI INPUT HANDLERS              //
///////////////////////////////////////////////////////////////

PioneerDDJRB.shiftButton = function(channel, control, value, status, group) {
    var index = 0;
    PioneerDDJRB.shiftPressed = (value == 0x7F);
    for (index in PioneerDDJRB.chFaderStart) {
        PioneerDDJRB.chFaderStart[index] = null;
    }
};

PioneerDDJRB.playButton = function(channel, control, value, status, group) {
    if (value) {
        script.toggleControl(PioneerDDJRB.deckSwitchTable[group], 'play');
    }
};

PioneerDDJRB.headphoneCueButton = function(channel, control, value, status, group) {
    if (value) {
        script.toggleControl(group, 'pfl');
    }
};

PioneerDDJRB.headphoneShiftCueButton = function(channel, control, value, status, group) {
    if (value) {
        script.toggleControl(PioneerDDJRB.deckShiftSwitchTable[group], 'pfl');
    }
};

PioneerDDJRB.hotCueButtons = function(channel, control, value, status, group) {
    var hotCueIndex = (control >= 0x40 ? control - 0x40 + 5 : control + 1);
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'hotcue_' + hotCueIndex + '_activate', value);
};

PioneerDDJRB.clearHotCueButtons = function(channel, control, value, status, group) {
    var hotCueIndex = (control >= 0x48 ? control - 0x48 + 5 : control - 7);
    if (value) {
        engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'hotcue_' + hotCueIndex + '_clear', 1);
    }
};

PioneerDDJRB.cueButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'cue_default', value);
};

PioneerDDJRB.beatloopButtons = function(channel, control, value, status, group) {
    var index = (control <= 0x13 ? control - 0x10 : control - 0x14);
    if (value) {
        engine.setValue(
            group,
            'beatloop_' + PioneerDDJRB.loopIntervals[index] + '_toggle',
            1
        );
    }
};

PioneerDDJRB.beatloopRollButtons = function(channel, control, value, status, group) {
    var index = (control <= 0x53 ? control - 0x50 : control - 0x54);
    engine.setValue(
        PioneerDDJRB.deckSwitchTable[group],
        'beatlooproll_' + PioneerDDJRB.looprollIntervals[index] + '_activate',
        value
    );
};

PioneerDDJRB.vinylButton = function(channel, control, value, status, group) {
    if (PioneerDDJRB.invertVinylSlipButton) {
        PioneerDDJRB.toggleSlip(channel, control, value, status, group);
    } else {
        PioneerDDJRB.toggleScratch(channel, control, value, status, group);
    }
};

PioneerDDJRB.slipButton = function(channel, control, value, status, group) {
    if (PioneerDDJRB.invertVinylSlipButton) {
        PioneerDDJRB.toggleScratch(channel, control, value, status, group);
    } else {
        PioneerDDJRB.toggleSlip(channel, control, value, status, group);
    }
};

PioneerDDJRB.toggleSlip = function(channel, control, value, status, group) {
    if (value) {
        script.toggleControl(group, 'slip_enabled');
    }
};

PioneerDDJRB.keyLockButton = function(channel, control, value, status, group) {
    if (value) {
        script.toggleControl(group, 'keylock');
    }
};

PioneerDDJRB.shiftKeyLockButton = function(channel, control, value, status, group) {
    var deck = status - 0x90;
    if (value) {
        PioneerDDJRB.speedRateToNormalTimer[deck] = engine.beginTimer(PioneerDDJRB.speedRateToNormalTime, "PioneerDDJRB.speedRateToNormal('" + group + "', " + deck + ")");
    }
};

PioneerDDJRB.loopInButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'loop_in', value ? 1 : 0);
};

PioneerDDJRB.loopOutButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'loop_out', value ? 1 : 0);
};

PioneerDDJRB.loopExitButton = function(channel, control, value, status, group) {
    if (value) {
        engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'reloop_exit', 1);
    }
};

PioneerDDJRB.loopHalveButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'loop_halve', value ? 1 : 0);
};

PioneerDDJRB.loopDoubleButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'loop_double', value ? 1 : 0);
};

PioneerDDJRB.loopMoveBackButton = function(channel, control, value, status, group) {
    if (value) {
        engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'loop_move', -1);
    }
};

PioneerDDJRB.loopMoveForwardButton = function(channel, control, value, status, group) {
    if (value) {
        engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'loop_move', 1);
    }
};

PioneerDDJRB.loadButton = function(channel, control, value, status, group) {
    if (value) {
        engine.setValue(group, 'LoadSelectedTrack', 1);
    }
};

PioneerDDJRB.reverseRollButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'reverseroll', value);
};

PioneerDDJRB.brakeButton = function(channel, control, value, status, group) {
    script.brake(channel, control, value, status, group);
};

PioneerDDJRB.syncButton = function(channel, control, value, status, group) {
    if (value) {
        script.toggleControl(group, 'sync_enabled');
    }
};

PioneerDDJRB.quantizeButton = function(channel, control, value, status, group) {
    if (value) {
        script.toggleControl(group, 'quantize');
    }
};

PioneerDDJRB.lowKillButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'filterLowKill', value ? 1 : 0);
};

PioneerDDJRB.midKillButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'filterMidKill', value ? 1 : 0);
};

PioneerDDJRB.highKillButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'filterHighKill', value ? 1 : 0);
};

PioneerDDJRB.muteButton = function(channel, control, value, status, group) {
    engine.setValue(PioneerDDJRB.deckSwitchTable[group], 'mute', value);
};


///////////////////////////////////////////////////////////////
//                          LED HELPERS                      //
///////////////////////////////////////////////////////////////

PioneerDDJRB.deckConverter = function(group) {
    var index;

    if (typeof group === "string") {
        for (index in PioneerDDJRB.deckSwitchTable) {
            if (group === PioneerDDJRB.deckSwitchTable[index]) {
                return PioneerDDJRB.channelGroups[group];
            }
        }
        return null;
    }
    return group;
};

PioneerDDJRB.fxLedControl = function(deck, ledNumber, shift, active) {
    var fxLedsBaseChannel = 0x94,
        fxLedsBaseControl = (shift ? 0x63 : 0x47),
        midiChannelOffset = PioneerDDJRB.deckConverter(deck);

    if (midiChannelOffset !== null) {
        midi.sendShortMsg(
            fxLedsBaseChannel + midiChannelOffset,
            fxLedsBaseControl + ledNumber,
            active ? 0x7F : 0x00
        );
    }
};

PioneerDDJRB.padLedControl = function(deck, groupNumber, shiftGroup, ledNumber, shift, active) {
    var padLedsBaseChannel = 0x97,
        padLedControl = (shiftGroup ? 0x40 : 0x00) + (shift ? 0x08 : 0x00) + groupNumber + ledNumber,
        midiChannelOffset = PioneerDDJRB.deckConverter(deck);

    if (midiChannelOffset !== null) {
        midi.sendShortMsg(
            padLedsBaseChannel + midiChannelOffset,
            padLedControl,
            active ? 0x7F : 0x00
        );
    }
};

PioneerDDJRB.nonPadLedControl = function(deck, ledNumber, active) {
    var nonPadLedsBaseChannel = 0x90,
        midiChannelOffset = PioneerDDJRB.deckConverter(deck);

    if (midiChannelOffset !== null) {
        midi.sendShortMsg(
            nonPadLedsBaseChannel + midiChannelOffset,
            ledNumber,
            active ? 0x7F : 0x00
        );
    }
};


///////////////////////////////////////////////////////////////
//                             LEDS                          //
///////////////////////////////////////////////////////////////

PioneerDDJRB.fxLeds = function(value, group, control) {
    var deck = PioneerDDJRB.fxGroups[group],
        ledNumber = PioneerDDJRB.fxControls[control];

    if (PioneerDDJRB.shiftPressed === false) {
        PioneerDDJRB.fxLedControl(deck, ledNumber, false, value);
    } else {
        PioneerDDJRB.fxLedControl(deck, ledNumber, true, value);
    }
};

PioneerDDJRB.headphoneCueLed = function(value, group, control) {
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.headphoneCue, value);
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.shiftHeadphoneCue, value);
};

PioneerDDJRB.keyLockLed = function(value, group, control) {
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.keyLock, value);
};

PioneerDDJRB.playLeds = function(value, group, control) {
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.play, value);
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.shiftPlay, value);
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.cue, value);
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.shiftCue, value);
};

PioneerDDJRB.slipLed = function(value, group, control) {
    var led = (PioneerDDJRB.invertVinylSlipButton ? PioneerDDJRB.nonPadLeds.vinyl : PioneerDDJRB.nonPadLeds.shiftVinyl);

    PioneerDDJRB.nonPadLedControl(group, led, value);
};

PioneerDDJRB.quantizeLed = function(value, group, control) {
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.shiftSync, value);
};

PioneerDDJRB.syncLed = function(value, group, control) {
    PioneerDDJRB.nonPadLedControl(group, PioneerDDJRB.nonPadLeds.sync, value);
};

PioneerDDJRB.loopInLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, false, 0, false, value);
};

PioneerDDJRB.loopOutLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, false, 1, false, value);
};

PioneerDDJRB.loopExitLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, false, 2, false, value);
};

PioneerDDJRB.loopHalveLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, false, 3, false, value);
};

PioneerDDJRB.loopDoubleLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, false, 3, true, value);
};

PioneerDDJRB.lowKillLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, true, 0, false, value);
};

PioneerDDJRB.midKillLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, true, 1, false, value);
};

PioneerDDJRB.highKillLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, true, 2, false, value);
};

PioneerDDJRB.muteLed = function(value, group, control) {
    PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.manualLoop, true, 3, false, value);
};

PioneerDDJRB.samplerLeds = function(value, group, control) {
    var sampler = PioneerDDJRB.samplerGroups[group],
        channel;

    for (channel = 0; channel < 4; channel++) {
        PioneerDDJRB.padLedControl(channel, PioneerDDJRB.ledGroups.sampler, false, sampler, false, value);
        PioneerDDJRB.padLedControl(channel, PioneerDDJRB.ledGroups.sampler, false, sampler, true, value);
        PioneerDDJRB.padLedControl(channel, PioneerDDJRB.ledGroups.sampler, true, sampler, false, value);
        PioneerDDJRB.padLedControl(channel, PioneerDDJRB.ledGroups.sampler, true, sampler, true, value);
    }
};

PioneerDDJRB.beatloopLeds = function(value, group, control) {
    var index,
        padNum,
        shifted;

    for (index in PioneerDDJRB.loopIntervals) {
        if (control === 'beatloop_' + PioneerDDJRB.loopIntervals[index] + '_enabled') {
            padNum = index % 4;
            shifted = (index >= 4);
            PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.autoLoop, false, padNum, shifted, value);
        }
    }
};

PioneerDDJRB.beatlooprollLeds = function(value, group, control) {
    var index,
        padNum,
        shifted;

    for (index in PioneerDDJRB.looprollIntervals) {
        if (control === 'beatlooproll_' + PioneerDDJRB.looprollIntervals[index] + '_activate') {
            padNum = index % 4;
            shifted = (index >= 4);
            PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.autoLoop, true, padNum, shifted, value);
        }
    }
};

PioneerDDJRB.hotCueLeds = function(value, group, control) {
    var shiftedGroup = false,
        padNum = null,
        hotCueNum;

    for (hotCueNum = 1; hotCueNum <= 8; hotCueNum++) {
        if (control === 'hotcue_' + hotCueNum + '_enabled') {
            padNum = (hotCueNum - 1) % 4;
            shiftedGroup = (hotCueNum > 4);
            PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.hotCue, shiftedGroup, padNum, false, value);
            PioneerDDJRB.padLedControl(group, PioneerDDJRB.ledGroups.hotCue, shiftedGroup, padNum, true, value);
        }
    }
};

PioneerDDJRB.VuMeterLeds = function(value, group, control) {
    var midiBaseAdress = 0xB0,
        channel = 0,
        midiOut = 0;

    value = 1 / (1 - PioneerDDJRB.cutVumeter) * (value - PioneerDDJRB.cutVumeter);
    if (value < 0) {
        value = 0;
    }

    value = parseInt(value * 0x7F);
    if (value < 0) {
        value = 0;
    }
    if (value > 127) {
        value = 127;
    }

    if (group == "[Master]") {
        if (control == "VuMeterL") {
            PioneerDDJRB.valueVuMeter['[Channel1]_current'] = value;
            PioneerDDJRB.valueVuMeter['[Channel3]_current'] = value;
        } else {
            PioneerDDJRB.valueVuMeter['[Channel2]_current'] = value;
            PioneerDDJRB.valueVuMeter['[Channel4]_current'] = value;
        }
    } else {
        PioneerDDJRB.valueVuMeter[group + '_current'] = value;
    }

    for (channel = 0; channel < 4; channel++) {
        midiOut = PioneerDDJRB.valueVuMeter['[Channel' + (channel + 1) + ']_current'];
        if (PioneerDDJRB.twinkleVumeterAutodjOn) {
            if (engine.getValue("[AutoDJ]", "enabled")) {
                if (PioneerDDJRB.valueVuMeter['[Channel' + (channel + 1) + ']_enabled']) {
                    midiOut = 0;
                }
            }
        }
        if (PioneerDDJRB.twinkleVumeterAutodjOn && engine.getValue("[AutoDJ]", "enabled") == 1) {
            if (midiOut < 5 && PioneerDDJRB.valueVuMeter['[Channel' + (channel + 1) + ']_enabled'] === 0) {
                midiOut = 5;
            }
        }
        midi.sendShortMsg(
            midiBaseAdress + channel,
            2,
            midiOut
        );
    }
};


///////////////////////////////////////////////////////////////
//                          JOGWHEELS                        //
///////////////////////////////////////////////////////////////

PioneerDDJRB.getJogWheelDelta = function(value) { // O
    // The Wheel control centers on 0x40; find out how much it's moved by.
    return value - 0x40;
};

PioneerDDJRB.jogRingTick = function(channel, control, value, status, group) {
    PioneerDDJRB.pitchBendFromJog(group, PioneerDDJRB.getJogWheelDelta(value));
};

PioneerDDJRB.jogRingTickShift = function(channel, control, value, status, group) {
    PioneerDDJRB.pitchBendFromJog(
        PioneerDDJRB.deckSwitchTable[group],
        PioneerDDJRB.getJogWheelDelta(value) * PioneerDDJRB.jogwheelShiftMultiplier
    );
};

PioneerDDJRB.jogPlatterTick = function(channel, control, value, status, group) {
    var deck = PioneerDDJRB.channelGroups[PioneerDDJRB.deckSwitchTable[group]];
    if (PioneerDDJRB.scratchMode[deck]) {
        engine.scratchTick(deck + 1, PioneerDDJRB.getJogWheelDelta(value));
    } else {
        PioneerDDJRB.pitchBendFromJog(PioneerDDJRB.deckSwitchTable[group], PioneerDDJRB.getJogWheelDelta(value));
    }
};

PioneerDDJRB.jogPlatterTickShift = function(channel, control, value, status, group) {
    var deck = PioneerDDJRB.channelGroups[PioneerDDJRB.deckSwitchTable[group]];
    if (PioneerDDJRB.scratchMode[deck]) {
        engine.scratchTick(deck + 1, PioneerDDJRB.getJogWheelDelta(value));
    } else {
        PioneerDDJRB.pitchBendFromJog(
            PioneerDDJRB.deckSwitchTable[group],
            PioneerDDJRB.getJogWheelDelta(value) * PioneerDDJRB.jogwheelShiftMultiplier
        );
    }
};

PioneerDDJRB.jogTouch = function(channel, control, value, status, group) {
    var deck = PioneerDDJRB.channelGroups[PioneerDDJRB.deckSwitchTable[group]];

    if (PioneerDDJRB.scratchMode[deck]) {
        if (value) {
            engine.scratchEnable(
                deck + 1,
                PioneerDDJRB.scratchSettings.jogResolution,
                PioneerDDJRB.scratchSettings.vinylSpeed,
                PioneerDDJRB.scratchSettings.alpha,
                PioneerDDJRB.scratchSettings.beta,
                true
            );
        } else {
            engine.scratchDisable(deck + 1, true);
        }
    }
};

PioneerDDJRB.toggleScratch = function(channel, control, value, status, group) {
    var deck = PioneerDDJRB.channelGroups[group];
    if (value) {
        PioneerDDJRB.scratchMode[deck] = !PioneerDDJRB.scratchMode[deck];
        PioneerDDJRB.triggerVinylLed(deck);
        if (!PioneerDDJRB.scratchMode[deck]) {
            engine.scratchDisable(deck + 1, true);
        }
    }
};

PioneerDDJRB.triggerVinylLed = function(deck) {
    var led = (PioneerDDJRB.invertVinylSlipButton ? PioneerDDJRB.nonPadLeds.shiftVinyl : PioneerDDJRB.nonPadLeds.vinyl);

    PioneerDDJRB.nonPadLedControl(deck, led, PioneerDDJRB.scratchMode[deck]);
};

PioneerDDJRB.pitchBendFromJog = function(channel, movement) {
    var group = (typeof channel === "string" ? channel : '[Channel' + channel + 1 + ']');

    engine.setValue(group, 'jog', movement / 5 * PioneerDDJRB.jogwheelSensivity);
};


///////////////////////////////////////////////////////////////
//                        ROTARY SELECTOR                    //
///////////////////////////////////////////////////////////////

PioneerDDJRB.rotarySelectorChanged = false; // new for DDJ-RB

PioneerDDJRB.getRotaryDelta = function(value) {
    var delta = 0x40 - Math.abs(0x40 - value),
        isCounterClockwise = value > 0x40;

    if (isCounterClockwise) {
        delta *= -1;
    }
    return delta;
};

PioneerDDJRB.rotarySelector = function(channel, control, value, status) {
    var delta = PioneerDDJRB.getRotaryDelta(value);
    engine.setValue('[Playlist]', 'SelectTrackKnob', delta);

    PioneerDDJRB.rotarySelectorChanged = true;
};

PioneerDDJRB.shiftedRotarySelector = function(channel, control, value, status) {
    var delta = PioneerDDJRB.getRotaryDelta(value),
        f = (delta > 0 ? 'SelectNextPlaylist' : 'SelectPrevPlaylist');

    engine.setValue('[Playlist]', f, Math.abs(delta));
};

PioneerDDJRB.rotarySelectorClick = function(channel, control, value, status) {
    if (PioneerDDJRB.rotarySelectorChanged === true) {
        if (value) {
            engine.setValue('[PreviewDeck1]', 'LoadSelectedTrackAndPlay', true);
        } else {
            if (PioneerDDJRB.jumpPreviewEnabled) {
                engine.setValue('[PreviewDeck1]', 'playposition', PioneerDDJRB.jumpPreviewPosition);
            }
            PioneerDDJRB.rotarySelectorChanged = false;
        }
    } else {
        if (value) {
            engine.setValue('[PreviewDeck1]', 'stop', 1);
        } else {
            PioneerDDJRB.rotarySelectorChanged = true;
        }
    }
};

PioneerDDJRB.rotarySelectorShiftedClick = function(channel, control, value, status) {
    if (value) {
        engine.setValue('[Playlist]', 'ToggleSelectedSidebarItem', 1);
    }
};


///////////////////////////////////////////////////////////////
//                             FX                            //
///////////////////////////////////////////////////////////////

PioneerDDJRB.fxKnobMSB = [0, 0];
PioneerDDJRB.fxKnobShiftedMSB = [0, 0];
PioneerDDJRB.fxKnobParameterSet = false;

PioneerDDJRB.fxButton = function(channel, control, value, status, group) {
    var deck = channel - 2,
        button = control - 0x47;

    PioneerDDJRB.fxButtonPressed[deck][button] = (value === 0x94);

    if (!value) {
        if (PioneerDDJRB.fxKnobParameterSet) {
            PioneerDDJRB.fxKnobParameterSet = false;
        } else {
            if (button === 0) {
                script.toggleControl(group, 'group_[Channel1]_enable');
            } else if (button === 1) {
                script.toggleControl(group, 'group_[Headphone]_enable');
            } else if (button === 2) {
                script.toggleControl(group, 'group_[Channel2]_enable');
            }
        }
    }
};

PioneerDDJRB.fxButtonShifted = function(channel, control, value, status, group) {
    var button = control - 0x63;
    if (!value) {
        if (button === 0) {
            script.toggleControl(group, 'group_[Channel3]_enable');
        } else if (button === 1) {
            script.toggleControl(group, 'group_[Master]_enable');
        } else if (button === 2) {
            script.toggleControl(group, 'group_[Channel4]_enable');
        }
    }
};

PioneerDDJRB.fxKnobShiftedMSB = function(channel, control, value, status) {
    PioneerDDJRB.fxKnobShiftedMSB[channel - 4] = value;
};

PioneerDDJRB.fxKnobShiftedLSB = function(channel, control, value, status) {
    var deck = channel - 4,
        fullValue = (PioneerDDJRB.fxKnobShiftedMSB[deck] << 7) + value;

    if (PioneerDDJRB.softTakeoverEmulation(deck, 4, PioneerDDJRB.fxKnobShiftedMSB[deck])) {
        engine.setValue('[EffectRack1_EffectUnit' + (deck + 1) + ']', 'super1', fullValue / 0x3FFF);
    }
};

PioneerDDJRB.fxKnobMSB = function(channel, control, value, status) {
    PioneerDDJRB.fxKnobMSB[channel - 4] = value;
};

PioneerDDJRB.fxKnobLSB = function(channel, control, value, status) {
    var deck = channel - 4,
        anyButtonPressed = false,
        fullValue = (PioneerDDJRB.fxKnobMSB[deck] << 7) + value,
        parameter;

    for (parameter = 0; parameter < 3; parameter++) {
        if (PioneerDDJRB.fxButtonPressed[deck][parameter]) {
            anyButtonPressed = true;
        }
    }

    if (!anyButtonPressed) {
        if (PioneerDDJRB.softTakeoverEmulation(deck, 3, PioneerDDJRB.fxKnobMSB[deck])) {
            engine.setValue('[EffectRack1_EffectUnit' + (deck + 1) + ']', 'mix', fullValue / 0x3FFF);
        }
    } else {
        for (parameter = 0; parameter < 3; parameter++) {
            if (PioneerDDJRB.fxButtonPressed[deck][parameter] && PioneerDDJRB.softTakeoverEmulation(deck, parameter, PioneerDDJRB.fxKnobMSB[deck])) {
                engine.setParameter(
                    '[EffectRack1_EffectUnit' + (deck + 1) + '_Effect1]',
                    'parameter' + (parameter + 1),
                    fullValue / 0x3FFF
                );
                PioneerDDJRB.fxKnobParameterSet = true;
            }
        }
    }
};

PioneerDDJRB.softTakeoverEmulation = function(deck, index, currentValue) {
    var deltaToActive = currentValue - PioneerDDJRB.fxParamsActiveValues[deck][index];

    if (Math.abs(deltaToActive) < 15) {
        PioneerDDJRB.fxParamsActiveValues[deck][index] = currentValue;
        return true;
    }
    return false;
};

