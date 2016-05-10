/* global getMessage */


var PagePlanner = function() {
  var _page = $('#pagePlanner');
  var _startGDate = null;
  var _endGDate = null;
  var _planRepeatUnits = null;
  var _planRepeatNum = null;
  var _plannerShowWhat = null;
  var _inPlanWhatChangeHandler = false;

  function generate() {
    if(_inPlanWhatChangeHandler) {
      return;
    }
    _planRepeatNum = +$('#planRepeatNum').val();
    _planRepeatUnits = $('#planRepeatUnits').val();
    _plannerShowWhat = $('#plannerShowWhat').val();

    var planFromWhen = $('#planFromWhen').val();
    var now = new Date();
    switch (planFromWhen) {
    case 'by0':
      _startGDate = new Date(holyDays.getGDate(getBadiYear(now), 1, 1).getTime());
      break;
    case 'by1':
      _startGDate = new Date(holyDays.getGDate(getBadiYear(now) + 1, 1, 1).getTime());
      break;
    case 'today':
    default:
      _startGDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }

    var planUntilNum = +$('#planUntilNum').val();
    var planUntilUnits = $('#planUntilUnits').val();
    _endGDate = new Date(_startGDate.getTime());
    switch (planUntilUnits) {
    case 'y':
      _endGDate.setFullYear(_startGDate.getFullYear() + planUntilNum);
      break;
    default:
      _endGDate.setFullYear(_startGDate.getFullYear(), 3);
      break;
    }

    var planWhat = $('#planWhat').val();
    switch (planWhat) {
    case 'event1':
    case 'event2':
      planEvent1(planWhat);
      break;
    }

    saveInputs();
  }

  function saveInputs() {
    $('.plannerInputs select').each(function(i, el) {
      setStorage(el.id, $(el).val());
    });
  }

  function recallInputs() {
    $('#planWhat').val(getStorage('planWhat')).trigger('adjust');

    $('.plannerInputs select').each(function(i, el) {
      var value = getStorage(el.id);
      if (typeof(value) !== "undefined") {
        $(el).val(value);
      }
    });
  }

  function addColSet(cells, frag, targetDi) {
    cells.push(
      ('<td>{' + frag + 'Year}/{' + frag + 'Month00}/{' + frag + 'Day00}</td>').filledWith(targetDi)
      + ('<td>{' + frag + 'WeekdayShort}</td>').filledWith(targetDi)
    );
  }


  function planEvent1(selectMode) {
    var plannerWhatEvent = $('#plannerWhatEvents').val() || '';

    var startBDate = holyDays.getBDate(_startGDate);
    var endBDate = holyDays.getBDate(_endGDate);
    var results = [];
    var targetYear = startBDate.y;
    var yearShown = 0;
    while (targetYear <= endBDate.y) {

      var dayInfos = holyDays.prepareDateInfos(targetYear);
      dayInfos.forEach(function(dayInfo, i) {
        var name = '';
        if (plannerWhatEvent === dayInfo.NameEn || plannerWhatEvent.includes(dayInfo.NameEn)) {
          // HD
          name = getMessage(dayInfo.NameEn);
        } else if (plannerWhatEvent === 'M_' + dayInfo.MonthNum || plannerWhatEvent.includes('M_' + dayInfo.MonthNum)) {
          // month
          name = getMessage('FeastOf').filledWith(bMonthNamePri[dayInfo.MonthNum]);
        } else {
          return;
        }
        var targetDi = getDateInfo(dayInfo.GDate);

        if (targetDi.frag2 < _startGDate) {
          return;
        }
        if (targetDi.frag2 > _endGDate) {
          return;
        }

        var thisYear = targetDi.bYear;
        var cells = [
          '<td>{0}</td>'.filledWith(name),
          '<td class="{1}">{0}</td>'.filledWith(thisYear, selectMode === 'event2' && thisYear !== yearShown ? 'plannerNewYear' : '')
        ];
        yearShown = thisYear;

        switch (_plannerShowWhat) {
        case 'both':
          addColSet(cells, 'frag1', targetDi);
          addColSet(cells, 'frag2', targetDi);
          break;
        default:
          addColSet(cells, _plannerShowWhat, targetDi);
          break;

        }

        cells.push('<td>{startingSunsetDesc}</td>'.filledWith(targetDi));


        results.push('<tr>' + cells.join('') + '</tr>');
      });

      targetYear++;
    }

    var th1 = [
      '<th colspan=2></th>'
    ];
    switch (_plannerShowWhat) {
    case 'both':
      th1.push('<th class=plannerThTitle colspan=2>{0}</th>'.filledWith($('#plannerShowWhat option[value="{0}"]'.filledWith('frag1')).text()));
      th1.push('<th class=plannerThTitle colspan=2>{0}</th>'.filledWith($('#plannerShowWhat option[value="{0}"]'.filledWith('frag2')).text()));
      break;
    default:
      th1.push('<th class=plannerThTitle colspan=2>{0}</th>'.filledWith($('#plannerShowWhat option[value="{0}"]'.filledWith(_plannerShowWhat)).text()));
      break;
    }
    th1.push('<th></th>');

    var th2 = [
      '<th>{0}</th>'.filledWith('Event'),
      '<th>{0}</th>'.filledWith('Year')
    ];
    th2.push('<th>{0}</th>'.filledWith('Date') + '<th>{0}</th>'.filledWith('Weekday'));
    if (_plannerShowWhat === 'both') {
      th2.push('<th>{0}</th>'.filledWith('Date') + '<th>{0}</th>'.filledWith('Weekday'));
    }

    th2.push('<th>{0}</th>'.filledWith('Starting Sunset'));


    $('#plannerResultsHead').html([
      '<tr>' + th1.join('') + '</tr>',
      '<tr>' + th2.join('') + '</tr>'
    ].join(''));
    $('#plannerResultsBody').html(results.join(''));
  }

  function fillInputs() {
    var dayInfos = holyDays.prepareDateInfos(_di.bYear); // can be any year... use current
    var hdOptions = [];
    var fOptions = [];
    dayInfos.forEach(function(dayInfo, i) {
      switch (dayInfo.Type[0]) {
      case 'H':
        hdOptions.push({ t: getMessage(dayInfo.NameEn), v: dayInfo.NameEn });
        break;
      case 'M':
        fOptions.push({ t: getMessage('FeastOf').filledWith(bMonthNamePri[dayInfo.MonthNum]), v: 'M_' + dayInfo.MonthNum });
        break;
      }
    });
    $('#planWhatHdGroup').html('<option value={v}>{t}</option>'.filledWithEach(hdOptions));
    $('#planWhatFeastGroup').html('<option value={v}>{t}</option>'.filledWithEach(fOptions));

    $('#planUntilNum').html('<option value="{0}">{0}</option>'.filledWithEach($.map($(Array(19)), function(val, i) { return 1 + i; })));
  }

  function startup() {
    fillInputs();
    $('#planUntilNum').val(10);
    attachHandlers();
    recallInputs();
    $('#planWhat').trigger('adjust');
    generate();
  }

  function resetPageForLanguageChange() {
    fillInputs();
    recallInputs();
    $('#planWhat').trigger('adjust');
    generate();
  }

  function attachHandlers() {
    $('#btnPlanGenerate').click(generate);
    $('#planWhat').on('change adjust', function (ev) {
      _inPlanWhatChangeHandler = ev.type === 'adjust';
      var ddl = $('#plannerWhatEvents');
      switch ($(ev.target).val()) {
        case 'event1':
          ddl[0].size = 1;
          ddl.prop('multiple', false);
          $('.plannerWhatHelpers').hide();
          break;
        case 'event2':
          ddl[0].size = 15;
          ddl.prop('multiple', true);
          $('.plannerWhatHelpers').show();
          break;
      }

      generate();
      _inPlanWhatChangeHandler = false;
    });

    $('.plannerWhatHelpers button').click(function (ev) {
      var btnId = ev.target.id;
      $('#plannerWhatEvents option').each(function (i, opt) {
        switch (btnId) {
          case 'btnPlannerHelperHD1':
            opt.selected = i < 9;
            break;
          case 'btnPlannerHelperHD2':
            opt.selected = i < 11;
            break;
          case 'btnPlannerHelperRid':
            opt.selected = opt.value.search('HolyDay_Ridvan') !== -1;
            break;
          case 'btnPlannerHelperTHB':
            opt.selected = opt.value.search('HolyDay_Birth') !== -1;
            break;
          case 'btnPlannerHelperFeasts':
            opt.selected = i > 10;
            break;
          case 'btnPlannerHelperNone':
            opt.selected = false;
            break;
        }
      });
      setTimeout(function() {
        generate();
      }, 0);
    });
    $('.plannerInputs select').change(function () {
      generate();
    });
  }

  startup();

  return {
    resetPageForLanguageChange: resetPageForLanguageChange
  }
}
