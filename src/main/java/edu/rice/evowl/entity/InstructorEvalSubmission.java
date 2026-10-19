package edu.rice.evowl.entity;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import java.util.Date;
import lombok.Data;

@Data
@ApiModel("InstructorEvalSubmission")
public class InstructorEvalSubmission {

  @ApiModelProperty("submission id")
  private String submission_id;

  @ApiModelProperty("deductions")
  private String deductions;

  @ApiModelProperty("unique id")
  private String unique_id;

  @ApiModelProperty("submit time")
  private Date submit_time;

  @ApiModelProperty("multiple choices")
  private String choices;

  @ApiModelProperty("free responses")
  private String free_responses;
}
