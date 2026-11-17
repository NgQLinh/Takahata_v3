using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TAKAHATA.Application.MaintenanceProcess.Commands;
using TAKAHATA.Application.MaintenanceProcess.Queries;
using TAKAHATA.Domain.Common.Constant;

namespace TAKAHATA.Api.Controllers
{
    public class MachineMaintenanceProcessController : ApiController
    {
        private readonly ISender _sender;

        public MachineMaintenanceProcessController(ISender sender)
        {
            _sender = sender;
        }

        [HttpPost("search")]
        [Authorize(Roles = Role.Admin)]
        public async Task<IActionResult> Search(MachineMaintenanceProcessesQuery request)
        {
            var result = await _sender.Send(request);
            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("create")]
        [Authorize(Roles = Role.Admin)]
        public async Task<IActionResult> Create(CreateMachineMaintenanceProcessCommand request)
        {
            var result = await _sender.Send(request);
            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("update")]
        [Authorize(Roles = Role.Admin)]
        public async Task<IActionResult> Update(UpdateMachineMaintenanceProcessCommand request)
        {
            var result = await _sender.Send(request);
            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("delete")]
        [Authorize(Roles = Role.Admin)]
        public async Task<IActionResult> Delete(DeleteMachineMaintenanceProcessCommand request)
        {
            var result = await _sender.Send(request);
            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("detail")]
        [Authorize(Roles = Role.Admin)]
        public async Task<IActionResult> GetMaintenanceProcessCommand(MachineMaintenanceProcessQuery request)
        {
            var result = await _sender.Send(request);
            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }

        [HttpPost("operate")]
        [Authorize(Roles = Role.User)]
        public async Task<IActionResult> Operate(OperateMachineMaintenanceProcessCommand request)
        {
            var result = await _sender.Send(request);
            return result.Match(
                r => Ok(r),
                e => Problem(e));
        }
    }
}
